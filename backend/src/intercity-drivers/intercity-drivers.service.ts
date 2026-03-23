import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DriverStatus } from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IntercityDriversService {
  constructor(private readonly prisma: PrismaService) {}

  async setOnlineStatus(userId: string, isOnline: boolean) {
    const driver = await this.prisma.intercityDriverProfile.findUnique({
      where: { userId },
    });
    if (!driver) {
      throw new NotFoundException('Intercity driver profile not found');
    }
    if (isOnline && driver.status !== DriverStatus.APPROVED) {
      throw new BadRequestException('Водитель межгорода не одобрен администратором');
    }
    return this.prisma.intercityDriverProfile.update({
      where: { userId },
      data: { isOnline },
    });
  }

  async getProfile(userId: string) {
    const driver = await this.prisma.intercityDriverProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!driver) {
      throw new NotFoundException('Intercity driver profile not found');
    }
    return driver;
  }

  async getCurrentOrder(userId: string) {
    const driver = await this.prisma.intercityDriverProfile.findUnique({
      where: { userId },
    });
    if (!driver) {
      throw new NotFoundException('Intercity driver profile not found');
    }
    return this.prisma.intercityOrder.findFirst({
      where: {
        driverId: driver.id,
        status: {
          in: ['CONFIRMED', 'DRIVER_EN_ROUTE', 'BOARDING', 'IN_PROGRESS'],
        },
      },
      include: {
        passenger: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  listPublicDrivers() {
    return this.prisma.intercityDriverProfile.findMany({
      where: {
        isOnline: true,
        status: DriverStatus.APPROVED,
      },
      include: {
        user: true,
      },
      orderBy: [{ rating: 'desc' }, { fullName: 'asc' }],
    });
  }
}
