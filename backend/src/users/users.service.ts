import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client/index';
import { randomUUID } from 'crypto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createUserWithProfile(params: {
    phone: string;
    email?: string;
    passwordHash: string;
    role: UserRole;
    fullName?: string;
    phoneVerifiedAt?: Date;
  }) {
    if (params.role === 'PASSENGER') {
      return this.prisma.user.create({
        data: {
          phone: params.phone,
          email: params.email,
          password: params.passwordHash,
          phoneVerifiedAt: params.phoneVerifiedAt,
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
          phoneVerifiedAt: params.phoneVerifiedAt,
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
          phoneVerifiedAt: params.phoneVerifiedAt,
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
          phoneVerifiedAt: params.phoneVerifiedAt,
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
          phoneVerifiedAt: params.phoneVerifiedAt,
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
        phoneVerifiedAt: params.phoneVerifiedAt,
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
        avatarUrl: true,
        phoneVerifiedAt: true,
        isDeleted: true,
        deletedAt: true,
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
    return this.prisma.user.findFirst({
      where: { phone, isDeleted: false },
      include: {
        passenger: true,
        driver: true,
        merchant: true,
      },
    });
  }

  markPhoneVerified(userId: string, date = new Date()) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { phoneVerifiedAt: date },
    });
  }

  findAuthUserById(userId: string) {
    return (this.prisma.user as any).findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        refreshTokenHash: true,
        isDeleted: true,
      },
    }) as Promise<
      | {
          id: string;
          role: UserRole;
          refreshTokenHash: string | null;
          isDeleted: boolean;
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

  updateAvatar(userId: string, avatarUrl: string | null) {
    return (this.prisma.user as any).update({
      where: { id: userId },
      data: { avatarUrl },
    });
  }

  async deleteCurrentUser(userId: string) {
    const tombstone = `deleted_${Date.now()}_${randomUUID().slice(0, 8)}`;

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: {
          passenger: true,
          driver: true,
          merchant: true,
        },
      });

      if (!user) {
        return { success: true };
      }

      if (user.passenger) {
        await tx.favoriteAddress.deleteMany({
          where: { passengerId: user.passenger.id },
        });

        await tx.passengerProfile.update({
          where: { id: user.passenger.id },
          data: { fullName: 'Удаленный аккаунт' },
        });
      }

      if (user.driver) {
        await tx.driverProfile.update({
          where: { id: user.driver.id },
          data: {
            fullName: 'Удаленный аккаунт',
            isOnline: false,
            lat: null,
            lng: null,
            supportsTaxi: false,
            supportsCourier: false,
            supportsIntercity: false,
          },
        });
      }

      if (user.merchant) {
        await tx.merchant.update({
          where: { id: user.merchant.id },
          data: {
            name: 'Удаленное заведение',
            whatsAppPhone: null,
            description: null,
            coverImageUrl: null,
            isOpen: false,
          },
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          phone: tombstone,
          email: tombstone,
          password: tombstone,
          refreshTokenHash: null,
          pushToken: null,
          avatarUrl: null,
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      return { success: true };
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

      await tx.driverProfile.update({
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

