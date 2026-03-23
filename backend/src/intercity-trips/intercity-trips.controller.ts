import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  IntercityBookingType,
  IntercityTripStatus,
  UserRole,
} from '@prisma/client/index';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { IntercityTripsService } from './intercity-trips.service';

class CreateIntercityTripDto {
  @IsString()
  fromCity!: string;

  @IsString()
  toCity!: string;

  @IsDateString()
  departureAt!: string;

  @Type(() => Number)
  @IsNumber()
  pricePerSeat!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  seatCapacity!: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

class BookIntercityTripDto {
  @IsEnum(IntercityBookingType)
  bookingType!: IntercityBookingType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  seatsBooked!: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

class UpdateIntercityTripStatusDto {
  @IsEnum(IntercityTripStatus)
  status!: IntercityTripStatus;
}

@Controller('intercity-trips')
export class IntercityTripsController {
  constructor(private readonly intercityTripsService: IntercityTripsService) {}

  @Get('public')
  listPublic(@Query('fromCity') fromCity?: string, @Query('toCity') toCity?: string) {
    return this.intercityTripsService.listPublicTrips({ fromCity, toCity });
  }

  @Get('my')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  listMy(@Req() req: any) {
    return this.intercityTripsService.listMyTrips(req.user.userId);
  }

  @Get('current')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  current(@Req() req: any) {
    return this.intercityTripsService.getCurrentTrip(req.user.userId);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  create(@Body() dto: CreateIntercityTripDto, @Req() req: any) {
    return this.intercityTripsService.createTrip(req.user.userId, {
      ...dto,
      departureAt: new Date(dto.departureAt),
    });
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  getById(@Param('id') id: string, @Req() req: any) {
    return this.intercityTripsService.getTripForDriver(req.user.userId, id);
  }

  @Post(':id/book')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.PASSENGER)
  book(@Param('id') id: string, @Body() dto: BookIntercityTripDto, @Req() req: any) {
    return this.intercityTripsService.bookTrip(req.user.userId, id, dto);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateIntercityTripStatusDto, @Req() req: any) {
    return this.intercityTripsService.updateTripStatus(req.user.userId, id, dto.status);
  }
}
