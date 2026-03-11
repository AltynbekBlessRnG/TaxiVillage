import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { RidesService } from './rides.service';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RideStatus, UserRole } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';

class CreateRideDto {
  @IsString()
  fromAddress!: string;

  @IsString()
  toAddress!: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  fromLat?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  fromLng?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  toLat?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  toLng?: number;
}

class UpdateRideStatusDto {
  @IsString()
  status!: keyof typeof RideStatus;
}

class RateRideDto {
  @IsInt()
  @Type(() => Number)
  stars!: number;
}

@Controller('rides')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  getMyRides(@Req() req: any) {
    const userId: string = req.user.userId;
    const role: UserRole = req.user.role;
    return this.ridesService.getRidesForUser(userId, role);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.PASSENGER)
  create(@Body() dto: CreateRideDto, @Req() req: any) {
    const userId: string = req.user.userId;
    return this.ridesService.createRideForPassenger(userId, dto);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  getById(@Param('id') id: string) {
    return this.ridesService.getRideById(id);
  }

  @Post(':id/cancel')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.PASSENGER)
  cancel(@Param('id') id: string, @Req() req: any) {
    const userId: string = req.user.userId;
    return this.ridesService.cancelRideByPassenger(userId, id);
  }

  @Post(':id/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateRideStatusDto, @Req() req: any) {
    const userId: string = req.user.userId;
    const role: UserRole = req.user.role;
    const status = RideStatus[dto.status];
    return this.ridesService.updateRideStatus(userId, role, id, status);
  }

  @Post(':id/accept')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  accept(@Param('id') id: string, @Req() req: any) {
    const userId: string = req.user.userId;
    return this.ridesService.acceptRide(userId, id);
  }

  @Post(':id/reject')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  reject(@Param('id') id: string) {
    return this.ridesService.rejectRide(id);
  }

  @Post(':id/rate')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.PASSENGER)
  rate(@Param('id') id: string, @Body() dto: RateRideDto, @Req() req: any) {
    const userId: string = req.user.userId;
    return this.ridesService.rateRide(userId, id, dto.stars);
  }
}

