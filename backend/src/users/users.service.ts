import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

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
      },
    });
  }

  findByPhone(phone: string) {
    return this.prisma.user.findUnique({
      where: { phone },
      include: {
        passenger: true,
        driver: true,
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
}

