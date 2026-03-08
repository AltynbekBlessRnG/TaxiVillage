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

  findByPhone(phone: string) {
    return this.prisma.user.findUnique({ where: { phone } });
  }
}

