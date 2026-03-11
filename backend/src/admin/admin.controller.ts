import { Body, Controller, Get, NotFoundException, Patch, Param, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEnum, IsNumber, Min } from 'class-validator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DriverStatus, UserRole } from '@prisma/client';

class UpdateDriverStatusDto {
  @IsEnum(DriverStatus)
  status!: DriverStatus;
}

class ApproveDocumentDto {
  @IsBoolean()
  approved!: boolean;
}

class TopUpDriverDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;
}

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
        documents: true,
      },
      orderBy: { user: { createdAt: 'desc' } },
    });
  }

  @Patch('documents/:id/approve')
  async approveDocument(
    @Param('id') documentId: string,
    @Body() dto: ApproveDocumentDto,
  ) {
    const doc = await this.prisma.driverDocument.findUnique({
      where: { id: documentId },
    });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    return this.prisma.driverDocument.update({
      where: { id: documentId },
      data: { approved: dto.approved },
    });
  }

  @Patch('drivers/:id/status')
  async updateDriverStatus(
    @Param('id') driverId: string,
    @Body() dto: UpdateDriverStatusDto,
  ) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
    });
    if (!driver) {
      throw new NotFoundException('Driver not found');
    }
    return this.prisma.driverProfile.update({
      where: { id: driverId },
      data: { status: dto.status },
      include: { user: true, car: true, documents: true },
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

  @Patch('drivers/:id/top-up')
  async topUpDriverBalance(
    @Param('id') driverId: string,
    @Body() dto: TopUpDriverDto,
  ) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
    });
    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    const amountDecimal = new Prisma.Decimal(dto.amount);

    const updated = await this.prisma.driverProfile.update({
      where: { id: driverId },
      data: {
        balance: { increment: amountDecimal },
      },
      include: { user: true, car: true, documents: true },
    });

    return updated;
  }
}

