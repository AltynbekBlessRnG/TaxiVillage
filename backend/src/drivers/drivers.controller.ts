import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { DriversService } from './drivers.service';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';

class SetStatusDto {
  @IsBoolean()
  isOnline!: boolean;
}

@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post('status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  setStatus(@Body() dto: SetStatusDto, @Req() req: any) {
    const userId: string = req.user.userId;
    return this.driversService.setOnlineStatus(userId, dto.isOnline);
  }

  @Get('current-ride')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  currentRide(@Req() req: any) {
    const userId: string = req.user.userId;
    return this.driversService.getCurrentRideForDriver(userId);
  }
}

