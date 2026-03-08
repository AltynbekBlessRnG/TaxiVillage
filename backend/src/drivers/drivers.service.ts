import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RideStatus } from '@prisma/client';

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  async setOnlineStatus(userId: string, isOnline: boolean) {
    const driver = await this.prisma.driverProfile.update({
      where: { userId },
      data: { isOnline },
    });
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
}

