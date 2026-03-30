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
              supportsCourier: true,
              supportsIntercity: false,
              driverMode: 'TAXI',
              courierTransportType: 'FOOT',
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
            documents: true,
          },
        },
        merchant: true,
      },
    });
  }

  findByPhone(phone: string) {
    return this.prisma.user.findUnique({
      where: { phone },
      include: {
        passenger: true,
        driver: true,
        merchant: true,
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
        driver: { include: { car: true, documents: true } },
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
            fullName: undefined,
            status: 'APPROVED',
            isOnline: false,
            rating: 5,
            supportsTaxi: false,
            supportsCourier: false,
            supportsIntercity: true,
            driverMode: 'INTERCITY',
          },
        }));

      await tx.driverProfile.update({
        where: { id: baseDriver.id },
        data: {
          fullName: baseDriver.fullName ?? undefined,
          status: baseDriver.status,
          isOnline: baseDriver.isOnline,
          rating: baseDriver.rating,
          supportsIntercity: true,
          supportsCourier: baseDriver.supportsCourier,
          supportsTaxi: baseDriver.supportsTaxi,
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
          driver: { include: { car: true, documents: true } },
          merchant: true,
        },
      });
    });
  }

  async upgradeLegacyCourier(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        driver: true,
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
            fullName: undefined,
            status: 'APPROVED',
            isOnline: false,
            rating: 5,
            balance: 0,
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
          fullName: baseDriver.fullName ?? undefined,
          status: baseDriver.status,
          isOnline: baseDriver.isOnline,
          rating: baseDriver.rating,
          balance: baseDriver.balance,
          supportsCourier: true,
          supportsTaxi: baseDriver.supportsTaxi,
          supportsIntercity: baseDriver.supportsIntercity,
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
          driver: { include: { car: true, documents: true } },
          merchant: true,
        },
      });
    });
  }

  async ensureUnifiedDriverProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        driver: true,
      },
    });

    if (!user || user.role !== 'DRIVER') {
      return user;
    }

    return this.prisma.$transaction(async (tx) => {
      const baseDriver =
        user.driver ??
        (await tx.driverProfile.create({
          data: {
            userId: user.id,
            fullName: undefined,
            status: 'APPROVED',
            isOnline: false,
            rating: 5,
            balance: 0,
            supportsTaxi: true,
            supportsCourier: true,
            supportsIntercity: false,
            driverMode: 'TAXI',
            courierTransportType: 'FOOT',
          },
        }));

      const updatedDriver = await tx.driverProfile.update({
        where: { id: baseDriver.id },
        data: {
          supportsTaxi: baseDriver.supportsTaxi ?? true,
          supportsCourier: true,
          supportsIntercity: baseDriver.supportsIntercity ?? false,
          driverMode: baseDriver.driverMode ?? 'TAXI',
          courierTransportType: baseDriver.courierTransportType ?? 'FOOT',
        },
      });

      return tx.user.findUnique({
        where: { id: user.id },
        include: {
          passenger: true,
          driver: { include: { car: true, documents: true } },
          merchant: true,
        },
      });
    });
  }
}

