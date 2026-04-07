import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsArray,
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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stops?: string[];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  womenOnly?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  baggageSpace?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  allowAnimals?: boolean;
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

class InviteOrderToTripDto {
  @IsString()
  orderId!: string;

  @IsOptional()
  @IsString()
  message?: string;
}

class PublicTripsFilterDto {
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  fromCity?: string;

  @IsOptional()
  @IsString()
  toCity?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seatsRequired?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  baggageRequired?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  womenOnly?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  noAnimals?: boolean;
}

@Controller('intercity-trips')
export class IntercityTripsController {
  constructor(private readonly intercityTripsService: IntercityTripsService) {}

  @Get('popular-routes')
  listPopularRoutes() {
    return this.intercityTripsService.listPopularRoutes();
  }

  @Get('public')
  listPublic(@Query() filters: PublicTripsFilterDto) {
    return this.intercityTripsService.listPublicTrips(filters);
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
  @UseGuards(AuthGuard('jwt'))
  book(@Param('id') id: string, @Body() dto: BookIntercityTripDto, @Req() req: any) {
    return this.intercityTripsService.bookTrip(req.user.userId, id, dto);
  }

  @Post(':id/invite-order')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  inviteOrder(@Param('id') id: string, @Body() dto: InviteOrderToTripDto, @Req() req: any) {
    return this.intercityTripsService.inviteOrderToTrip(req.user.userId, id, dto.orderId, dto.message);
  }

  @Post('invites/:id/accept')
  @UseGuards(AuthGuard('jwt'))
  acceptInvite(@Param('id') id: string, @Req() req: any) {
    return this.intercityTripsService.acceptInvite(req.user.userId, id);
  }

  @Post('invites/:id/decline')
  @UseGuards(AuthGuard('jwt'))
  declineInvite(@Param('id') id: string, @Req() req: any) {
    return this.intercityTripsService.declineInvite(req.user.userId, id);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateIntercityTripStatusDto, @Req() req: any) {
    return this.intercityTripsService.updateTripStatus(req.user.userId, id, dto.status);
  }
}
