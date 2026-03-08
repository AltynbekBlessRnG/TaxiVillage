import { Injectable, NotFoundException } from '@nestjs/common';
import { RideStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RidesService {
  constructor(private readonly prisma: PrismaService) {}

  async createRideForPassenger(userId: string, data: { fromAddress: string; toAddress: string }) {
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

    const ride = await this.prisma.ride.create({
      data: {
        passengerId: passengerProfile.id,
        driverId: driver?.id,
        tariffId: activeTariff
          ? activeTariff.id
          : await this.ensureDefaultTariffId(),
        status: driver ? RideStatus.DRIVER_ASSIGNED : RideStatus.SEARCHING_DRIVER,
        fromAddress: data.fromAddress,
        toAddress: data.toAddress,
        fromLat: 0,
        fromLng: 0,
        toLat: 0,
        toLng: 0,
      },
    });

    await this.prisma.rideStatusHistory.create({
      data: {
        rideId: ride.id,
        status: ride.status,
      },
    });

    return ride;
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

    const updated = await this.prisma.ride.update({
      where: { id: rideId },
      data: {
        status,
        startedAt: status === RideStatus.IN_PROGRESS && !ride.startedAt ? new Date() : ride.startedAt,
        finishedAt: status === RideStatus.COMPLETED ? new Date() : ride.finishedAt,
      },
    });

    await this.prisma.rideStatusHistory.create({
      data: {
        rideId,
        status,
      },
    });

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

