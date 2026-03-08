import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
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
}

class UpdateRideStatusDto {
  @IsString()
  status!: keyof typeof RideStatus;
}

@Controller('rides')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

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

  @Post(':id/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateRideStatusDto, @Req() req: any) {
    const userId: string = req.user.userId;
    const role: UserRole = req.user.role;
    const status = RideStatus[dto.status];
    return this.ridesService.updateRideStatus(userId, role, id, status);
  }
}

