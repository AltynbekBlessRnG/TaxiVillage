import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client/index';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createUserWithProfile(params: {
    phone: string;
    email?: string;
    passwordHash: string;
    role: UserRole;
    fullName?: string;
  }) {
    if (params.role === 'PASSENGER') {
      return this.prisma.user.create({
        data: {
          phone: params.phone,
          email: params.email,
          password: params.passwordHash,
          role: 'PASSENGER',
          passenger: {
            create: {
              fullName: params.fullName,
            },
          },
        },
      });
    }

    if (params.role === 'DRIVER') {
      return this.prisma.user.create({
        data: {
          phone: params.phone,
          email: params.email,
          password: params.passwordHash,
          role: 'DRIVER',
          driver: {
            create: {
              fullName: params.fullName,
              supportsTaxi: true,
              supportsCourier: false,
              supportsIntercity: false,
              driverMode: 'TAXI',
            },
          },
        },
      });
    }

    if (params.role === 'COURIER') {
      return this.prisma.user.create({
        data: {
          phone: params.phone,
          email: params.email,
          password: params.passwordHash,
          role: 'COURIER',
          driver: {
            create: {
              fullName: params.fullName,
              supportsTaxi: false,
              supportsCourier: true,
              supportsIntercity: false,
              driverMode: 'COURIER',
              courierTransportType: 'FOOT',
              status: 'APPROVED',
            },
          },
          courier: {
            create: {
              fullName: params.fullName,
            },
          },
        },
      });
    }

    if (params.role === 'MERCHANT') {
      return this.prisma.user.create({
        data: {
          phone: params.phone,
          email: params.email,
          password: params.passwordHash,
          role: 'MERCHANT',
          merchant: {
            create: {
              name: params.fullName || 'Новое заведение',
            },
          },
        },
      });
    }

    if (params.role === 'DRIVER_INTERCITY') {
      return this.prisma.user.create({
        data: {
          phone: params.phone,
          email: params.email,
          password: params.passwordHash,
          role: 'DRIVER_INTERCITY',
          driver: {
            create: {
              fullName: params.fullName,
              supportsTaxi: false,
              supportsCourier: false,
              supportsIntercity: true,
              driverMode: 'INTERCITY',
            },
          },
          intercityDriver: {
            create: {
              fullName: params.fullName,
            },
          },
        },
      });
    }

    return this.prisma.user.create({
      data: {
        phone: params.phone,
        email: params.email,
        password: params.passwordHash,
        role: 'ADMIN',
      },
    });
  }
  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        passenger: true,
        driver: {
          include: {
            car: true,
          },
        },
        courier: true,
        merchant: true,
        intercityDriver: true,
      },
    });
  }

  findByPhone(phone: string) {
    return this.prisma.user.findUnique({
      where: { phone },
      include: {
        passenger: true,
        driver: true,
        courier: true,
        merchant: true,
        intercityDriver: true,
      },
    });
  }

  findAuthUserById(userId: string) {
    return (this.prisma.user as any).findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        refreshTokenHash: true,
      },
    }) as Promise<
      | {
          id: string;
          role: UserRole;
          refreshTokenHash: string | null;
        }
      | null
    >;
  }

  updateRefreshTokenHash(userId: string, refreshTokenHash: string | null) {
    return (this.prisma.user as any).update({
      where: { id: userId },
      data: { refreshTokenHash },
    });
  }

  updatePushToken(userId: string, pushToken: string | null) {
    return (this.prisma.user as any).update({
      where: { id: userId },
      data: { pushToken },
    });
  }

  async upgradeLegacyIntercityDriver(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        driver: { include: { car: true } },
        intercityDriver: true,
      },
    });

    if (!user || user.role !== 'DRIVER_INTERCITY') {
      return user;
    }

    return this.prisma.$transaction(async (tx) => {
      const baseDriver =
        user.driver ??
        (await tx.driverProfile.create({
          data: {
            userId: user.id,
            fullName: user.intercityDriver?.fullName ?? undefined,
            status: user.intercityDriver?.status ?? 'APPROVED',
            isOnline: user.intercityDriver?.isOnline ?? false,
            rating: user.intercityDriver?.rating ?? 5,
            supportsTaxi: false,
            supportsCourier: false,
            supportsIntercity: true,
            driverMode: 'INTERCITY',
          },
        }));

      await tx.driverProfile.update({
        where: { id: baseDriver.id },
        data: {
          fullName: baseDriver.fullName ?? user.intercityDriver?.fullName ?? undefined,
          status: user.intercityDriver?.status ?? baseDriver.status,
          isOnline: user.intercityDriver?.isOnline ?? baseDriver.isOnline,
          rating: user.intercityDriver?.rating ?? baseDriver.rating,
          supportsIntercity: true,
          supportsCourier: baseDriver.supportsCourier ?? false,
          supportsTaxi: baseDriver.supportsTaxi ?? false,
          driverMode: 'INTERCITY',
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          role: 'DRIVER',
        },
      });

      return tx.user.findUnique({
        where: { id: user.id },
        include: {
          passenger: true,
          driver: true,
          courier: true,
          merchant: true,
          intercityDriver: true,
        },
      });
    });
  }

  async upgradeLegacyCourier(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        driver: true,
        courier: true,
      },
    });

    if (!user || user.role !== 'COURIER') {
      return user;
    }

    return this.prisma.$transaction(async (tx) => {
      const baseDriver =
        user.driver ??
        (await tx.driverProfile.create({
          data: {
            userId: user.id,
            fullName: user.courier?.fullName ?? undefined,
            status: user.courier?.status ?? 'APPROVED',
            isOnline: user.courier?.isOnline ?? false,
            rating: user.courier?.rating ?? 5,
            balance: user.courier?.balance ?? 0,
            supportsTaxi: false,
            supportsCourier: true,
            supportsIntercity: false,
            driverMode: 'COURIER',
            courierTransportType: 'FOOT',
          },
        }));

      await tx.driverProfile.update({
        where: { id: baseDriver.id },
        data: {
          fullName: baseDriver.fullName ?? user.courier?.fullName ?? undefined,
          status: user.courier?.status ?? baseDriver.status,
          isOnline: user.courier?.isOnline ?? baseDriver.isOnline,
          rating: user.courier?.rating ?? baseDriver.rating,
          balance: user.courier?.balance ?? baseDriver.balance,
          supportsCourier: true,
          driverMode: 'COURIER',
          courierTransportType: baseDriver.courierTransportType ?? 'FOOT',
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          role: 'DRIVER',
        },
      });

      return tx.user.findUnique({
        where: { id: user.id },
        include: {
          passenger: true,
          driver: true,
          courier: true,
          merchant: true,
          intercityDriver: true,
        },
      });
    });
  }
}

