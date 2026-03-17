import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RideStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RidesGateway } from './rides.gateway';

/** Расстояние по прямой (км) по формуле Haversine */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // радиус Земли в км
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
export class RidesService {
  private readonly logger = new Logger(RidesService.name);
  private readonly rideOfferTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ridesGateway: RidesGateway,
  ) {}

  async createRideForPassenger(
    userId: string,
    data: {
      fromAddress: string;
      toAddress: string;
      fromLat?: number;
      fromLng?: number;
      toLat?: number;
      toLng?: number;
      comment?: string;
      stops?: Array<{
        address: string;
        lat: number;
        lng: number;
      }>;
      paymentMethod?: 'CARD' | 'CASH';
      estimatedPrice?: number;
    },
  ) {
    const passengerProfile = await this.prisma.passengerProfile.findUnique({
      where: { userId },
    });
    if (!passengerProfile) {
      throw new NotFoundException('Passenger profile not found');
    }

    const activeTariff = await this.prisma.tariff.findFirst({
      where: { isActive: true },
    });

    const tariffId = activeTariff
      ? activeTariff.id
      : await this.ensureDefaultTariffId();
    const tariff = await this.prisma.tariff.findUnique({
      where: { id: tariffId },
    });
    if (!tariff) throw new NotFoundException('Tariff not found');

    const fromLat = data.fromLat ?? 0;
    const fromLng = data.fromLng ?? 0;
    const toLat = data.toLat ?? 0;
    const toLng = data.toLng ?? 0;

    let distanceKm = 5; // fallback для городской поездки
    const hasFrom = fromLat !== 0 || fromLng !== 0;
    const hasTo = toLat !== 0 || toLng !== 0;
    
    // Calculate total distance including stops
    distanceKm = 0;
    const coordinates: { lat: number; lng: number }[] = [];
    
    // Add starting point
    if (hasFrom) {
      coordinates.push({ lat: fromLat, lng: fromLng });
    }
    
    // Add stops if provided
    if (data.stops && data.stops.length > 0) {
      data.stops.forEach(stop => {
        coordinates.push({ lat: stop.lat, lng: stop.lng });
      });
    }
    
    // Add destination
    if (hasTo) {
      coordinates.push({ lat: toLat, lng: toLng });
    }
    
    // Calculate distance between each consecutive pair of points
    for (let i = 0; i < coordinates.length - 1; i++) {
      distanceKm += haversineDistance(
        coordinates[i].lat,
        coordinates[i].lng,
        coordinates[i + 1].lat,
        coordinates[i + 1].lng
      );
    }
    
    // If no coordinates available, use default
    if (distanceKm === 0 && hasFrom && !hasTo) {
      distanceKm = 3; // только точка отправления — оцениваем 3 км по умолчанию
    }

    const estimatedMinutes = Math.ceil((distanceKm / 0.5)); // ~30 км/ч в городе
    const baseFare = Number(tariff.baseFare);
    const pricePerKm = Number(tariff.pricePerKm);
    const pricePerMinute = tariff.pricePerMinute
      ? Number(tariff.pricePerMinute)
      : 0;
    const finalEstimatedPrice = data.estimatedPrice 
  ? new Prisma.Decimal(data.estimatedPrice) 
  : new Prisma.Decimal(baseFare + distanceKm * pricePerKm + estimatedMinutes * pricePerMinute);

const ride = await this.prisma.$transaction(async (tx) => {
  const created = await tx.ride.create({
    data: {
      passengerId: passengerProfile.id,
      tariffId,
      status: RideStatus.SEARCHING_DRIVER,
      fromAddress: data.fromAddress,
      toAddress: data.toAddress,
      fromLat,
      fromLng,
      toLat,
      toLng,
      comment: data.comment || null,
      paymentMethod: data.paymentMethod || 'CARD',
      estimatedPrice: finalEstimatedPrice, // Используем нашу переменную
    },
  });

      // Create stops if provided
      if (data.stops && data.stops.length > 0) {
        for (let i = 0; i < data.stops.length; i++) {
          // @ts-ignore - rideStop model exists in schema but not in types yet
          await tx.rideStop.create({
            data: {
              rideId: created.id,
              address: data.stops[i].address,
              lat: data.stops[i].lat,
              lng: data.stops[i].lng,
            },
          });
        }
      }

      await tx.rideStatusHistory.create({
        data: {
          rideId: created.id,
          status: RideStatus.SEARCHING_DRIVER,
        },
      });
      return created;
    });

    const rideWithUsers = await this.getRideById(ride.id);
    
    // Проверяем, есть ли реальные координаты
    const hasRoute = (fromLat !== 0 && fromLng !== 0) && (toLat !== 0 && toLng !== 0);
    const ridePayload = { ...rideWithUsers, hasRoute };

    this.ridesGateway.emitRideCreated(ridePayload as any);

    // Trigger Smart Dispatch (передаем payload вместе с флагом hasRoute!)
    await this.findAndOfferRideToDriver(ridePayload);

    return {
      ...ride,
      hasRoute
    };
  }

  async getRidesForUser(userId: string, role: UserRole) {
    if (role === 'PASSENGER') {
      const passenger = await this.prisma.passengerProfile.findUnique({
        where: { userId },
      });
      if (!passenger) return [];
      return this.prisma.ride.findMany({
        where: { passengerId: passenger.id },
        include: {
          passenger: true,
          driver: { include: { car: true } },
          tariff: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    }
    if (role === 'DRIVER') {
      const driver = await this.prisma.driverProfile.findUnique({
        where: { userId },
      });
      if (!driver) return [];
      return this.prisma.ride.findMany({
        where: { driverId: driver.id },
        include: {
          passenger: true,
          driver: { include: { car: true } },
          tariff: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    }
    return [];
  }

  async getRideById(id: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id },
      include: {
        passenger: true,
        driver: {
          include: {
            car: true,
          },
        },
        tariff: true,
        // @ts-ignore - stops field exists in schema but not in types yet
        stops: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!ride) {
      throw new NotFoundException('Ride not found');
    }
    return ride;
  }

  async cancelRideByPassenger(userId: string, rideId: string) {
    const passenger = await this.prisma.passengerProfile.findUnique({
      where: { userId },
    });
    if (!passenger) {
      throw new NotFoundException('Passenger profile not found');
    }
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) {
      throw new NotFoundException('Ride not found');
    }
    if (ride.passengerId !== passenger.id) {
      throw new NotFoundException('Ride not found');
    }
    if (ride.status !== RideStatus.SEARCHING_DRIVER && ride.status !== RideStatus.DRIVER_ASSIGNED) {
      throw new NotFoundException('Cannot cancel ride in current status');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.ride.update({
        where: { id: rideId },
        data: { status: RideStatus.CANCELED },
      });
      await tx.rideStatusHistory.create({
        data: { rideId, status: RideStatus.CANCELED },
      });
      return u;
    });
    const rideWithUsers = await this.getRideById(rideId);
    this.ridesGateway.emitRideUpdated(rideWithUsers as any);
    return updated;
  }

  async updateRideStatus(userId: string, role: UserRole, rideId: string, status: RideStatus) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: { tariff: true, driver: true },
    });
    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (role === 'DRIVER') {
      const driverProfile = await this.prisma.driverProfile.findUnique({
        where: { userId },
      });
      if (!driverProfile || ride.driverId !== driverProfile.id) {
        throw new NotFoundException('Ride not assigned to this driver');
      }
    }

    const now = new Date();
    const startedAt =
      status === RideStatus.IN_PROGRESS && !ride.startedAt ? now : ride.startedAt;
    const finishedAt = status === RideStatus.COMPLETED ? now : ride.finishedAt;

    let finalPrice: Prisma.Decimal | undefined;
    let commissionAmount: Prisma.Decimal | undefined;
    if (status === RideStatus.COMPLETED && ride.estimatedPrice) {
      finalPrice = ride.estimatedPrice;
      // Calculate commission
      const commissionPercent = ride.tariff?.systemCommissionPercent ?? 10;
      commissionAmount = new Prisma.Decimal(
        (Number(finalPrice) * commissionPercent) / 100,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.ride.update({
        where: { id: rideId },
        data: {
          status,
          startedAt,
          finishedAt,
          ...(finalPrice !== undefined && { finalPrice }),
          ...(commissionAmount !== undefined && { commissionAmount }),
        },
      });

      // Deduct commission from driver balance and update lastRideFinishedAt
      if (status === RideStatus.COMPLETED && commissionAmount && ride.driverId) {
        const driver = await tx.driverProfile.findUnique({
          where: { id: ride.driverId },
          select: { balance: true }
        });

        if (!driver) {
          throw new NotFoundException('Driver not found');
        }

        const currentBalance = Number(driver.balance);
        const commissionToDeduct = Number(commissionAmount);

        if (currentBalance < commissionToDeduct) {
          this.logger.warn(`Driver ${ride.driverId} has insufficient balance (${currentBalance}) for commission (${commissionToDeduct})`);
          // Still proceed with ride completion but don't deduct commission
        } else {
          await tx.driverProfile.update({
            where: { id: ride.driverId },
            data: {
              balance: { decrement: commissionAmount },
              lastRideFinishedAt: now,
            },
          });
        }
      }

      await tx.rideStatusHistory.create({
        data: {
          rideId,
          status,
        },
      });

      return u;
    });

    const rideWithUsers = await this.getRideById(rideId);
    this.ridesGateway.emitRideUpdated(rideWithUsers as any);

    return updated;
  }

  async acceptRide(driverUserId: string, rideId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId: driverUserId },
    });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    // Check driver balance - prevent negative balance
    const MIN_BALANCE = -500; // Allow small negative buffer but prevent debt accumulation
    if (Number(driver.balance) < MIN_BALANCE) {
      throw new BadRequestException(
        `Баланс слишком низкий (${driver.balance} ₸). Пополните баланс чтобы принимать заказы. Минимум: ${MIN_BALANCE} ₸`
      );
    }

    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) {
      throw new NotFoundException('Ride not found');
    }
    if (ride.status !== RideStatus.SEARCHING_DRIVER) {
      throw new NotFoundException('Ride is no longer available');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.ride.update({
        where: { id: rideId },
        data: {
          driverId: driver.id,
          status: RideStatus.DRIVER_ASSIGNED,
        },
      });
      await tx.rideStatusHistory.create({
        data: {
          rideId,
          status: RideStatus.DRIVER_ASSIGNED,
        },
      });
      return u;
    });

    // Clear timeout since ride was accepted
    this.clearRideOfferTimeout(rideId);

    const rideWithUsers = await this.getRideById(rideId);
    this.ridesGateway.emitRideUpdated(rideWithUsers as any);

    return updated;
  }

  async rejectRide(rideId: string) {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) {
      throw new NotFoundException('Ride not found');
    }
    
    // Clear timeout since ride was rejected
    this.clearRideOfferTimeout(rideId);
    
    // Just return the ride - the passenger continues searching or can cancel
    return ride;
  }

  async rateRide(passengerUserId: string, rideId: string, stars: number) {
    if (stars < 1 || stars > 5) {
      throw new NotFoundException('Rating must be between 1 and 5');
    }

    const passenger = await this.prisma.passengerProfile.findUnique({
      where: { userId: passengerUserId },
    });
    if (!passenger) {
      throw new NotFoundException('Passenger profile not found');
    }

    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: { driver: true },
    });
    if (!ride) {
      throw new NotFoundException('Ride not found');
    }
    if (ride.passengerId !== passenger.id) {
      throw new NotFoundException('Ride not found');
    }
    if (ride.status !== RideStatus.COMPLETED) {
      throw new NotFoundException('Can only rate completed rides');
    }
    if (ride.driverRating !== null) {
      throw new NotFoundException('Ride already rated');
    }
    if (!ride.driverId) {
      throw new NotFoundException('No driver assigned to this ride');
    }

    await this.prisma.$transaction(async (tx) => {
      // Save the rating on the ride
      await tx.ride.update({
        where: { id: rideId },
        data: { driverRating: stars },
      });

      // Recalculate driver rating
      const driverRides = await tx.ride.findMany({
        where: {
          driverId: ride.driverId,
          driverRating: { not: null },
        },
        select: { driverRating: true },
      });

      const totalRatings = driverRides.length;
      const sumRatings = driverRides.reduce(
        (sum, r) => sum + (r.driverRating ?? 0),
        0,
      );
      const newRating = totalRatings > 0 ? sumRatings / totalRatings : 5.0;

      if (ride.driverId) {
        await tx.driverProfile.update({
          where: { id: ride.driverId },
          data: { rating: newRating },
        });
      }
    });

    return { success: true };
  }

  private async findAndOfferRideToDriver(rideWithUsers: any, attempt: number = 1, excludedDriverIds: Set<string> = new Set()) {
    const MAX_ATTEMPTS = 3;
    const OFFER_TIMEOUT = 30000; // 30 seconds
    
    if (attempt > MAX_ATTEMPTS) {
      this.logger.warn(`Ride ${rideWithUsers.id} - No driver found after ${MAX_ATTEMPTS} attempts, canceling ride`);
      await this.cancelRideIfSearching(rideWithUsers.id);
      return;
    }

    const fromLat = rideWithUsers.fromLat;
    const fromLng = rideWithUsers.fromLng;

    // Find all eligible drivers: online, approved, non-negative balance, not previously offered
    const drivers = await this.prisma.driverProfile.findMany({
      where: {
        status: 'APPROVED',
        isOnline: true,
        balance: { gte: new Prisma.Decimal(-500) }, // Match acceptRide threshold
        lat: { not: null },
        lng: { not: null },
        id: { notIn: Array.from(excludedDriverIds) }, // Exclude already offered drivers
      },
      include: {
        user: true,
      },
    });

    if (drivers.length === 0) {
      this.logger.warn(`Ride ${rideWithUsers.id} - No eligible drivers available (attempt ${attempt})`);
      return;
    }

    // Calculate distances and sort
    // Calculate distances and sort
    const driversWithDistance = drivers.map((driver) => ({
      driver,
      // Если координат нет (они равны 0), ставим дистанцию 0, чтобы заказ точно попал в радиус 3км
      distance: (fromLat === 0 && fromLng === 0) 
        ? 0 
        : haversineDistance(fromLat, fromLng, driver.lat!, driver.lng!),
    }));

    // Filter drivers within 3km radius
    const nearbyDrivers = driversWithDistance
      .filter((d) => d.distance <= 3)
      .sort((a, b) => {
        // Sort by lastRideFinishedAt (oldest first - fair rotation)
        // New drivers (null) go to end of queue, not front
        const timeA = a.driver.lastRideFinishedAt?.getTime() || Date.now();
        const timeB = b.driver.lastRideFinishedAt?.getTime() || Date.now();
        return timeA - timeB;
      });

    let selectedDriver: (typeof driversWithDistance)[0] | null = null;

    if (nearbyDrivers.length > 0) {
      // Select the driver with oldest lastRideFinishedAt within 3km
      selectedDriver = nearbyDrivers[0];
    } else {
      // No drivers in 3km radius - pick the closest one citywide
      driversWithDistance.sort((a, b) => a.distance - b.distance);
      selectedDriver = driversWithDistance[0];
    }

    if (selectedDriver) {
      this.logger.log(`Ride ${rideWithUsers.id} - Offering to driver ${selectedDriver.driver.userId} (attempt ${attempt}/${MAX_ATTEMPTS})`);
      
      // Add this driver to excluded list for next attempts
      excludedDriverIds.add(selectedDriver.driver.id);
      
      // Set timeout for this offer
      const timeout = setTimeout(async () => {
        this.logger.log(`Ride ${rideWithUsers.id} - Driver ${selectedDriver.driver.userId} didn't respond, trying next driver`);
        await this.findAndOfferRideToDriver(rideWithUsers, attempt + 1, excludedDriverIds);
      }, OFFER_TIMEOUT);
      
      this.rideOfferTimeouts.set(rideWithUsers.id, timeout);
      
      // Send ride offer to the selected driver
      this.ridesGateway.emitRideOffer(
        selectedDriver.driver.userId,
        rideWithUsers as any,
      );
    } else {
      this.logger.warn(`Ride ${rideWithUsers.id} - No driver found for attempt ${attempt}`);
    }
  }

  private async cancelRideIfSearching(rideId: string) {
    try {
      await this.prisma.ride.update({
        where: { id: rideId },
        data: { status: RideStatus.CANCELED },
      });
      
      const rideWithUsers = await this.getRideById(rideId);
      this.ridesGateway.emitRideUpdated(rideWithUsers as any);
    } catch (error) {
      this.logger.error(`Failed to cancel ride ${rideId}:`, error);
    }
  }

  clearRideOfferTimeout(rideId: string) {
    const timeout = this.rideOfferTimeouts.get(rideId);
    if (timeout) {
      clearTimeout(timeout);
      this.rideOfferTimeouts.delete(rideId);
    }
  }

  private async ensureDefaultTariffId(): Promise<string> {
    const existing = await this.prisma.tariff.findFirst();
    if (existing) {
      return existing.id;
    }
    const created = await this.prisma.tariff.create({
      data: {
        name: 'Стандарт',
        baseFare: 100,
        pricePerKm: 15,
      },
    });
    return created.id;
  }

  async completeRide(userId: string, rideId: string, finalPrice?: number) {
    // 1. Находим профиль водителя по userId (Именно здесь был баг!)
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId }
    });
    
    if (!driver) {
      throw new BadRequestException('Профиль водителя не найден');
    }

    // 2. Ищем саму поездку по правильному driver.id
    const ride = await this.prisma.ride.findFirst({
      where: {
        id: rideId,
        driverId: driver.id,
      },
      include: { tariff: true }
    });

    if (!ride) {
      throw new BadRequestException('Поездка не найдена');
    }

    const priceToUse = finalPrice || Number(ride.estimatedPrice || 0);
    
    // 3. Считаем комиссию системы (по умолчанию 10%)
    const commissionPercent = ride.tariff?.systemCommissionPercent ?? 10;
    const commissionAmount = new Prisma.Decimal((priceToUse * commissionPercent) / 100);

    // 4. Обновляем всё в одной безопасной транзакции
    const updatedRide = await this.prisma.$transaction(async (tx) => {
      const u = await tx.ride.update({
        where: { id: rideId },
        data: {
          status: 'COMPLETED',
          finalPrice: priceToUse,
          finishedAt: new Date(),
          commissionAmount: commissionAmount
        },
        include: {
          passenger: { include: { user: true } },
          driver: { include: { user: true } },
        },
      });

      // Списываем комиссию с баланса водителя
      await tx.driverProfile.update({
        where: { id: driver.id },
        data: {
          balance: { decrement: commissionAmount },
          lastRideFinishedAt: new Date(),
        },
      });

      // Пишем в историю статусов
      await tx.rideStatusHistory.create({
        data: { rideId, status: 'COMPLETED' },
      });

      return u;
    });

    // 5. Отправляем сокет всем участникам, чтобы у пассажира вылезла табличка оплаты
    this.ridesGateway.emitRideUpdated(updatedRide as any);

    return updatedRide;
  }
}
