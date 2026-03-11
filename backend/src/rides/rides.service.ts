import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
    if (hasFrom && hasTo) {
      distanceKm = haversineDistance(fromLat, fromLng, toLat, toLng);
    } else if (hasFrom && !hasTo) {
      // только точка отправления — оцениваем 3 км по умолчанию
      distanceKm = 3;
    }

    const estimatedMinutes = Math.ceil((distanceKm / 0.5)); // ~30 км/ч в городе
    const baseFare = Number(tariff.baseFare);
    const pricePerKm = Number(tariff.pricePerKm);
    const pricePerMinute = tariff.pricePerMinute
      ? Number(tariff.pricePerMinute)
      : 0;
    const estimatedPrice = new Prisma.Decimal(
      baseFare +
        distanceKm * pricePerKm +
        estimatedMinutes * pricePerMinute,
    );

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
          estimatedPrice,
        },
      });
      await tx.rideStatusHistory.create({
        data: {
          rideId: created.id,
          status: RideStatus.SEARCHING_DRIVER,
        },
      });
      return created;
    });

    const rideWithUsers = await this.getRideById(ride.id);
    this.ridesGateway.emitRideCreated(rideWithUsers as any);

    // Trigger Smart Dispatch
    await this.findAndOfferRideToDriver(rideWithUsers);

    return ride;
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
        await tx.driverProfile.update({
          where: { id: ride.driverId },
          data: {
            balance: { decrement: commissionAmount },
            lastRideFinishedAt: now,
          },
        });
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
    const MIN_BALANCE = -1000; // Allow some negative buffer but not too much
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

    const rideWithUsers = await this.getRideById(rideId);
    this.ridesGateway.emitRideUpdated(rideWithUsers as any);

    return updated;
  }

  async rejectRide(rideId: string) {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) {
      throw new NotFoundException('Ride not found');
    }
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

  private async findAndOfferRideToDriver(rideWithUsers: any) {
    const fromLat = rideWithUsers.fromLat;
    const fromLng = rideWithUsers.fromLng;

    // Find all eligible drivers: online, approved, non-negative balance
    const drivers = await this.prisma.driverProfile.findMany({
      where: {
        status: 'APPROVED',
        isOnline: true,
        balance: { gte: new Prisma.Decimal(0) },
        lat: { not: null },
        lng: { not: null },
      },
      include: {
        user: true,
      },
    });

    if (drivers.length === 0) {
      return; // No drivers available
    }

    // Calculate distances and sort
    const driversWithDistance = drivers.map((driver) => ({
      driver,
      distance: haversineDistance(fromLat, fromLng, driver.lat!, driver.lng!),
    }));

    // Filter drivers within 4km radius
    const nearbyDrivers = driversWithDistance
      .filter((d) => d.distance <= 4)
      .sort((a, b) => {
        // Sort by lastRideFinishedAt (oldest first - fair rotation)
        const timeA = a.driver.lastRideFinishedAt?.getTime() ?? 0;
        const timeB = b.driver.lastRideFinishedAt?.getTime() ?? 0;
        return timeA - timeB;
      });

    let selectedDriver: (typeof driversWithDistance)[0] | null = null;

    if (nearbyDrivers.length > 0) {
      // Select the driver with oldest lastRideFinishedAt within 4km
      selectedDriver = nearbyDrivers[0];
    } else {
      // No drivers in 4km radius - pick the closest one citywide
      driversWithDistance.sort((a, b) => a.distance - b.distance);
      selectedDriver = driversWithDistance[0];
    }

    if (selectedDriver) {
      // Send ride offer to the selected driver
      this.ridesGateway.emitRideOffer(
        selectedDriver.driver.userId,
        rideWithUsers as any,
      );
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
}

