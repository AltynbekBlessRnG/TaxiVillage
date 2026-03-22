import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';
import { CouriersService } from './couriers.service';

class SetStatusDto {
  @IsBoolean()
  isOnline!: boolean;
}

class UpdateLocationDto {
  @IsNumber()
  @Type(() => Number)
  lat!: number;

  @IsNumber()
  @Type(() => Number)
  lng!: number;
}

@Controller('couriers')
export class CouriersController {
  constructor(private readonly couriersService: CouriersService) {}

  @Post('status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.COURIER)
  setStatus(@Body() dto: SetStatusDto, @Req() req: any) {
    return this.couriersService.setOnlineStatus(req.user.userId, dto.isOnline);
  }

  @Patch('location')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.COURIER)
  updateLocation(@Body() dto: UpdateLocationDto, @Req() req: any) {
    return this.couriersService.updateLocation(req.user.userId, dto.lat, dto.lng);
  }

  @Get('current-order')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.COURIER)
  currentOrder(@Req() req: any) {
    return this.couriersService.getCurrentOrderForCourier(req.user.userId);
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.COURIER)
  getProfile(@Req() req: any) {
    return this.couriersService.getProfile(req.user.userId);
  }
}
