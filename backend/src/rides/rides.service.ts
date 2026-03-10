import { Injectable, NotFoundException } from '@nestjs/common';
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

    const driver = await this.prisma.driverProfile.findFirst({
      where: {
        status: 'APPROVED',
        isOnline: true,
      },
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
          driverId: driver?.id,
          tariffId,
          status: driver ? RideStatus.DRIVER_ASSIGNED : RideStatus.SEARCHING_DRIVER,
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
          status: created.status,
        },
      });
      return created;
    });

    const rideWithUsers = await this.getRideById(ride.id);
    this.ridesGateway.emitRideCreated(rideWithUsers as any);

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
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
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
    if (status === RideStatus.COMPLETED && ride.estimatedPrice) {
      finalPrice = ride.estimatedPrice;
    }

    const updated = await this.prisma.ride.update({
      where: { id: rideId },
      data: {
        status,
        startedAt,
        finishedAt,
        ...(finalPrice !== undefined && { finalPrice }),
      },
    });

    await this.prisma.rideStatusHistory.create({
      data: {
        rideId,
        status,
      },
    });

    const rideWithUsers = await this.getRideById(rideId);
    this.ridesGateway.emitRideUpdated(rideWithUsers as any);

    return updated;
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

