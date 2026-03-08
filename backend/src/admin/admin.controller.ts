import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('users')
  getUsers() {
    return this.prisma.user.findMany({
      include: {
        passenger: true,
        driver: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('drivers')
  getDrivers() {
    return this.prisma.driverProfile.findMany({
      include: {
        user: true,
        car: true,
      },
      orderBy: { user: { createdAt: 'desc' } },
    });
  }

  @Get('rides')
  getRides() {
    return this.prisma.ride.findMany({
      include: {
        passenger: true,
        driver: true,
        tariff: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}

