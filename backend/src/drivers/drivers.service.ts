import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentType, RideStatus } from '@prisma/client';
import { RidesGateway } from '../rides/rides.gateway';

@Injectable()
export class DriversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ridesGateway: RidesGateway,
  ) {}

  async setOnlineStatus(userId: string, isOnline: boolean) {
    const data: { isOnline: boolean; lastRideFinishedAt?: Date } = { isOnline };
    if (isOnline) {
      data.lastRideFinishedAt = new Date();
    }
    const driver = await this.prisma.driverProfile.update({
      where: { userId },
      data,
    });
    return driver;
  }

  async updateLocation(userId: string, lat: number, lng: number) {
    const driver = await this.prisma.driverProfile.update({
      where: { userId },
      data: { lat, lng },
    });

    // Check if driver has an active ride and emit driver movement
    const currentRide = await this.prisma.ride.findFirst({
      where: {
        driverId: driver.id,
        status: {
          in: [RideStatus.ON_THE_WAY, RideStatus.IN_PROGRESS],
        },
      },
    });

    if (currentRide) {
      this.ridesGateway.emitDriverMoved(currentRide.id, lat, lng);
    }

    return driver;
  }

  async getCurrentRideForDriver(userId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    return this.prisma.ride.findFirst({
      where: {
        driverId: driver.id,
        status: {
          in: [
            RideStatus.DRIVER_ASSIGNED,
            RideStatus.ON_THE_WAY,
            RideStatus.IN_PROGRESS,
          ],
        },
      },
    });
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

  async getProfile(userId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
      include: { car: true, documents: true },
    });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }
    return driver;
  }
}

