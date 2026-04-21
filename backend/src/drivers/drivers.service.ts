import { Injectable, NotFoundException, BadRequestException, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, CourierOrderStatus, CourierTransportType, DocumentType, DriverMode, DriverStatus, RideStatus } from '@prisma/client/index';
import { RidesGateway } from '../rides/rides.gateway';
import { RedisService } from '../redis/redis.service';

/** Haversine distance calculation */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

@Injectable()
export class DriversService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DriversService.name);
  private readonly ACTIVE_RIDE_CACHE_TTL = 3000;
  
  constructor(
    private readonly prisma: PrismaService,
    private readonly ridesGateway: RidesGateway,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  private locationCache = new Map<string, { lat: number; lng: number; lastUpdate: Date }>();
  private activeRideCache = new Map<string, { rideId: string | null; checkedAt: number }>();
  private readonly BATCH_INTERVAL = 30000; // 30 seconds
  private readonly CACHE_CLEANUP_INTERVAL = 60000; // 1 minute - clean old entries
  private locationBatchTimer?: NodeJS.Timeout;
  private cacheCleanupTimer?: NodeJS.Timeout;
  private unsubscribeOfflinePresence?: () => void;

  // Start location batching on service initialization
  onModuleInit() {
    this.unsubscribeOfflinePresence = this.redisService.onUserOffline((userId) =>
      this.handleUserPresenceOffline(userId),
    );

    this.locationBatchTimer = setInterval(() => {
      this.flushLocationBatch();
    }, this.BATCH_INTERVAL);
    
    this.cacheCleanupTimer = setInterval(() => {
      this.cleanupOldCacheEntries();
    }, this.CACHE_CLEANUP_INTERVAL);
  }

  // Cleanup on service destruction
  onModuleDestroy() {
    this.unsubscribeOfflinePresence?.();
    if (this.locationBatchTimer) {
      clearInterval(this.locationBatchTimer);
      this.flushLocationBatch(); // Flush any remaining updates
    }
    if (this.cacheCleanupTimer) {
      clearInterval(this.cacheCleanupTimer);
    }
  }

  private cleanupOldCacheEntries() {
    const now = new Date();
    const STALE_TIME = 120000; // 2 minutes
    
    for (const [userId, location] of this.locationCache.entries()) {
      if (now.getTime() - location.lastUpdate.getTime() > STALE_TIME) {
        this.locationCache.delete(userId);
      }
    }

    for (const [userId, activeRide] of this.activeRideCache.entries()) {
      if (Date.now() - activeRide.checkedAt > STALE_TIME) {
        this.activeRideCache.delete(userId);
      }
    }
    
    if (this.locationCache.size > 0) {
      this.logger.debug(`Location cache contains ${this.locationCache.size} active drivers`);
    }
  }

  private async flushLocationBatch() {
    if (this.locationCache.size === 0) return;

    const updates: Array<{ userId: string; lat: number; lng: number }> = [];
    
    for (const [userId, location] of this.locationCache.entries()) {
      updates.push({ userId, lat: location.lat, lng: location.lng });
    }

    if (updates.length > 0) {
      try {
        // Batch update all locations in a single transaction
        await this.prisma.$transaction(
          updates.map(({ userId, lat, lng }) =>
            this.prisma.driverProfile.update({
              where: { userId },
              data: { lat, lng },
            })
          )
        );
        
        this.logger.log(`Batch updated ${updates.length} driver locations`);
      } catch (error) {
        this.logger.error('Failed to batch update locations:', error);
      }
    }

    // Clear the cache
    this.locationCache.clear();
  }

  private async handleUserPresenceOffline(userId: string) {
    this.activeRideCache.delete(userId);
    await Promise.all([
      this.redisService.clearCachedLocation('driver', userId),
      this.redisService.clearCachedLocation('courier', userId),
      this.prisma.driverProfile.updateMany({
        where: { userId, isOnline: true },
        data: { isOnline: false },
      }),
    ]);
  }

  private async getActiveRideId(userId: string) {
    const cached = this.activeRideCache.get(userId);
    if (cached && Date.now() - cached.checkedAt < this.ACTIVE_RIDE_CACHE_TTL) {
      return cached.rideId;
    }

    const assignment = await this.redisService.getActiveAssignment('ride', userId);
    if (assignment?.entityId) {
      this.activeRideCache.set(userId, {
        rideId: assignment.entityId,
        checkedAt: Date.now(),
      });
      return assignment.entityId;
    }

    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!driver) {
      this.activeRideCache.set(userId, { rideId: null, checkedAt: Date.now() });
      return null;
    }

    const currentRide = await this.prisma.ride.findFirst({
      where: {
        driverId: driver.id,
        status: {
          in: [RideStatus.ON_THE_WAY, RideStatus.DRIVER_ARRIVED, RideStatus.IN_PROGRESS],
        },
      },
      select: { id: true },
    });

    const rideId = currentRide?.id ?? null;
    this.activeRideCache.set(userId, { rideId, checkedAt: Date.now() });
    return rideId;
  }

  async setOnlineStatus(userId: string, isOnline: boolean) {
    // If going online, validate driver profile
    if (isOnline) {
      const driver = await this.prisma.driverProfile.findUnique({
        where: { userId },
        include: { car: true, documents: true },
      });

      if (!driver) {
        throw new NotFoundException('Профиль водителя не найден');
      }

      // Check driver approval status
      if (driver.status !== DriverStatus.APPROVED) {
        throw new BadRequestException('Водитель не одобрен администратором');
      }

      if (Number(driver.balance ?? 0) <= 0) {
        throw new BadRequestException('Баланс пустой. Пополните баланс, чтобы выйти на линию.');
      }

      if (driver.driverMode === DriverMode.INTERCITY) {
        return this.prisma.driverProfile.update({
          where: { userId },
          data: { isOnline },
        });
      }

      if (driver.driverMode === DriverMode.COURIER) {
        const approvedDocuments = driver.documents.filter((doc) => doc.approved);
        const hasCourierId = approvedDocuments.some((doc) => doc.type === DocumentType.COURIER_ID);
        const requiresVehicleDocs =
          driver.courierTransportType === CourierTransportType.CAR ||
          driver.courierTransportType === CourierTransportType.BIKE;

        if (!hasCourierId) {
          throw new BadRequestException('Необходимо загрузить и получить одобрение удостоверения курьера');
        }

        if (requiresVehicleDocs) {
          if (!driver.car || !driver.car.make || !driver.car.model || !driver.car.color || !driver.car.plateNumber) {
            throw new BadRequestException('Для выбранного курьерского транспорта нужно заполнить информацию об автомобиле');
          }

          const hasDriverLicense = approvedDocuments.some((doc) => doc.type === DocumentType.DRIVER_LICENSE);
          const hasCarRegistration = approvedDocuments.some((doc) => doc.type === DocumentType.CAR_REGISTRATION);

          if (!hasDriverLicense) {
            throw new BadRequestException('Для выбранного курьерского транспорта нужно загрузить и получить одобрение водительского удостоверения');
          }
          if (!hasCarRegistration) {
            throw new BadRequestException('Для выбранного курьерского транспорта нужно загрузить и получить одобрение СТС');
          }
        }

        return this.prisma.driverProfile.update({
          where: { userId },
          data: { isOnline },
        });
      }

      // Check car information
      if (!driver.car) {
        throw new BadRequestException('Необходимо добавить информацию об автомобиле');
      }
      if (!driver.car.make || !driver.car.model || !driver.car.color || !driver.car.plateNumber) {
        throw new BadRequestException('Необходимо заполнить все поля автомобиля (марка, модель, цвет, номер)');
      }

      // Check approved documents
      const approvedDocuments = driver.documents.filter((doc) => doc.approved);
      const hasDriverLicense = approvedDocuments.some((doc) => doc.type === DocumentType.DRIVER_LICENSE);
      const hasCarRegistration = approvedDocuments.some((doc) => doc.type === DocumentType.CAR_REGISTRATION);

      if (!hasDriverLicense) {
        throw new BadRequestException('Необходимо загрузить и получить одобрение водительского удостоверения');
      }
      if (!hasCarRegistration) {
        throw new BadRequestException('Необходимо загрузить и получить одобрение СТС (свидетельство о регистрации ТС)');
      }
    }

    return this.prisma.driverProfile.update({
      where: { userId },
      data: { isOnline },
    });
  }

  async updateLocation(userId: string, lat: number, lng: number) {
    // Store in cache instead of immediate DB write
    this.locationCache.set(userId, { lat, lng, lastUpdate: new Date() });
    await this.redisService.cacheLocation('driver', userId, lat, lng);

    const activeRideId = await this.getActiveRideId(userId);
    if (activeRideId) {
      await this.prisma.driverProfile.update({
        where: { userId },
        data: { lat, lng },
      });
      this.ridesGateway.emitDriverMoved(activeRideId, lat, lng);
    }

    return { success: true };
  }

  async getCurrentRideForDriver(userId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const assignment = await this.redisService.getActiveAssignment('ride', userId);
    if (assignment?.entityId) {
      const activeStatuses: RideStatus[] = [
        RideStatus.DRIVER_ASSIGNED,
        RideStatus.ON_THE_WAY,
        RideStatus.DRIVER_ARRIVED,
        RideStatus.IN_PROGRESS,
      ];
      const rideFromRedis = await this.prisma.ride.findUnique({
        where: { id: assignment.entityId },
      });

      if (
        rideFromRedis &&
        rideFromRedis.driverId === driver.id &&
        activeStatuses.includes(rideFromRedis.status)
      ) {
        this.activeRideCache.set(userId, {
          rideId: rideFromRedis.id,
          checkedAt: Date.now(),
        });
        return rideFromRedis;
      }

      await this.redisService.clearActiveAssignment('ride', userId);
    }

    const ride = await this.prisma.ride.findFirst({
      where: {
        driverId: driver.id,
        status: {
          in: [
            RideStatus.DRIVER_ASSIGNED,
            RideStatus.ON_THE_WAY,
            RideStatus.DRIVER_ARRIVED,
            RideStatus.IN_PROGRESS,
          ],
        },
      },
    });

    this.activeRideCache.set(userId, {
      rideId: ride?.id ?? null,
      checkedAt: Date.now(),
    });

    if (ride?.id) {
      await this.redisService.setActiveAssignment('ride', userId, ride.id, ride.status);
    } else {
      await this.redisService.clearActiveAssignment('ride', userId);
    }

    return ride;
  }

  async upsertCar(
    userId: string,
    data: { make: string; model: string; color: string; plateNumber: string },
  ) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
      include: { car: true },
    });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }
    if (driver.car) {
      return this.prisma.car.update({
        where: { id: driver.car.id },
        data,
      });
    }
    return this.prisma.car.create({
      data: {
        driverId: driver.id,
        ...data,
      },
    });
  }

  async addDocument(
    userId: string,
    type: DocumentType,
    fileUrl: string,
  ) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }
    return this.prisma.driverDocument.create({
      data: {
        driverId: driver.id,
        type,
        url: fileUrl,
      },
    });
  }

  async updateProfile(userId: string, data: { fullName: string }) {
    const fullName = data.fullName?.trim();
    if (!fullName) {
      throw new BadRequestException('Имя не может быть пустым');
    }

    const updatedDriver = await this.prisma.driverProfile.update({
      where: { userId },
      data: { fullName },
      include: {
        car: true,
        documents: true,
        user: true,
      },
    });

    return updatedDriver;
  }

  async getProfile(userId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        car: true,
        documents: true,
        user: true,
      },
    });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    return driver;
  }

  async getMetrics(userId: string, days = 7) {
    const clampedDays = Math.max(1, Math.min(30, Math.round(days || 7)));
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
      include: {
        user: true,
      },
    });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const periodStart = new Date(todayStart);
    periodStart.setDate(periodStart.getDate() - (clampedDays - 1));

    const [completedRides, completedDeliveries] = await Promise.all([
      this.prisma.ride.findMany({
        where: {
          driverId: driver.id,
          status: RideStatus.COMPLETED,
          finishedAt: { gte: periodStart },
        },
        select: {
          finishedAt: true,
          finalPrice: true,
          estimatedPrice: true,
        },
      }),
      driver.supportsCourier
        ? this.prisma.courierOrder.findMany({
            where: {
              courierId: driver.id,
              status: CourierOrderStatus.DELIVERED,
              deliveredAt: { gte: periodStart },
            },
            select: {
              deliveredAt: true,
              finalPrice: true,
              estimatedPrice: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const buckets = Array.from({ length: clampedDays }, (_, index) => {
      const date = new Date(periodStart);
      date.setDate(periodStart.getDate() + index);
      const isoDate = date.toISOString().slice(0, 10);
      return {
        date: isoDate,
        label: date.toLocaleDateString('ru-RU', { weekday: 'short' }),
        earnings: 0,
      };
    });

    const addToBucket = (dateValue: Date | null | undefined, amountValue: Prisma.Decimal | number | null | undefined) => {
      if (!dateValue) {
        return;
      }
      const key = new Date(dateValue).toISOString().slice(0, 10);
      const bucket = buckets.find((item) => item.date === key);
      if (!bucket) {
        return;
      }
      bucket.earnings += Number(amountValue ?? 0);
    };

    completedRides.forEach((ride) => addToBucket(ride.finishedAt, ride.finalPrice ?? ride.estimatedPrice));
    completedDeliveries.forEach((order) => addToBucket(order.deliveredAt, order.finalPrice ?? order.estimatedPrice));

    const todayEarnings = buckets.find((item) => item.date === todayStart.toISOString().slice(0, 10))?.earnings ?? 0;

    return {
      todayEarnings,
      dailyBuckets: buckets.map((bucket) => ({
        ...bucket,
        earnings: Math.round(bucket.earnings),
      })),
      completedTaxiRides: completedRides.length,
      completedCourierDeliveries: completedDeliveries.length,
      rating: Number(driver.rating ?? 5),
      balance: Number(driver.balance ?? 0),
    };
  }

  async getTopUpInfo(userId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
      select: {
        balance: true,
      },
    });

    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    return {
      balance: Number(driver.balance ?? 0),
      canGoOnline: Number(driver.balance ?? 0) > 0,
      title: this.configService.get<string>('DRIVER_TOPUP_TITLE') || 'Пополнение баланса',
      recipient: this.configService.get<string>('DRIVER_TOPUP_RECIPIENT') || 'TaxiVillage',
      requisites:
        this.configService.get<string>('DRIVER_TOPUP_REQUISITES') ||
        'Kaspi: +7 776 741 5410 Темірхан А.',
      note:
        this.configService.get<string>('DRIVER_TOPUP_NOTE') ||
        'После перевода администратор пополнит баланс вручную.',
    };
  }

  async setDriverMode(userId: string, driverMode: DriverMode) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }
    if (driverMode === DriverMode.INTERCITY && !driver.supportsIntercity) {
      throw new BadRequestException('Межгородний режим еще не включен в профиле');
    }
    if (driverMode === DriverMode.COURIER && !driver.supportsCourier) {
      throw new BadRequestException('Курьерский режим еще не включен в профиле');
    }
    if (driverMode === DriverMode.TAXI && !driver.supportsTaxi) {
      throw new BadRequestException('Такси-режим недоступен для этого профиля');
    }

    return this.prisma.driverProfile.update({
      where: { userId },
      data: { driverMode },
      include: {
        car: true,
        documents: true,
        user: true,
      },
    });
  }

  async updateIntercityCapability(userId: string, supportsIntercity: boolean) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    return this.prisma.driverProfile.update({
      where: { userId },
      data: {
        supportsIntercity,
        driverMode:
          supportsIntercity && driver.driverMode === DriverMode.TAXI
            ? driver.driverMode
            : supportsIntercity
              ? driver.driverMode
              : DriverMode.TAXI,
      },
      include: {
        car: true,
        user: true,
      },
    });
  }

  async updateCourierCapability(
    userId: string,
    params: { supportsCourier: boolean; courierTransportType?: CourierTransportType | null },
  ) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const updated = await this.prisma.driverProfile.update({
      where: { userId },
      data: {
        supportsCourier: params.supportsCourier,
        courierTransportType: params.supportsCourier
          ? params.courierTransportType ?? driver.courierTransportType ?? CourierTransportType.FOOT
          : null,
        driverMode:
          !params.supportsCourier && driver.driverMode === DriverMode.COURIER
            ? DriverMode.TAXI
            : driver.driverMode,
      },
      include: {
        car: true,
        user: true,
      },
    });

    return updated;
  }

  async getNearbyDrivers(lat: number, lng: number, radius: number) {
    const nearbyUserIds = await this.redisService.findNearbyUsers('driver', lat, lng, radius, 50);
    const latDelta = radius / 111;
    const lngDelta = radius / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.1));

    const drivers = await this.prisma.driverProfile.findMany({
      where: {
        status: 'APPROVED',
        isOnline: true,
        supportsTaxi: true,
        driverMode: DriverMode.TAXI,
        ...(nearbyUserIds.length > 0
          ? { userId: { in: nearbyUserIds } }
          : {
              lat: { not: null, gte: lat - latDelta, lte: lat + latDelta },
              lng: { not: null, gte: lng - lngDelta, lte: lng + lngDelta },
            }),
      },
      select: {
        id: true,
        userId: true,
        fullName: true,
        lat: true,
        lng: true,
      },
    });

    const cachedLocations = await this.redisService.getCachedLocations(
      'driver',
      drivers.map((driver) => driver.userId),
    );

    // Filter by distance and return only necessary info
    const nearbyDrivers = drivers
      .map(driver => ({
        id: driver.id,
        fullName: driver.fullName || 'Водитель',
        lat: cachedLocations.get(driver.userId)?.lat ?? driver.lat!,
        lng: cachedLocations.get(driver.userId)?.lng ?? driver.lng!,
      }))
      .filter(driver => {
        const distance = haversineDistance(lat, lng, driver.lat, driver.lng);
        return distance <= radius;
      })
      .slice(0, 20); // Limit to 20 drivers for performance

    return nearbyDrivers;
  }
}

