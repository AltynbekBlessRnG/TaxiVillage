import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard } from '@nestjs/passport';
import { IntercityOrderStatus, UserRole } from '@prisma/client/index';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { IntercityOrdersService } from './intercity-orders.service';

class CreateIntercityOrderDto {
  @IsString()
  fromCity!: string;

  @IsString()
  toCity!: string;

  @IsDateString()
  departureAt!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  seats!: number;

  @IsOptional()
  @IsString()
  baggage?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @Type(() => Number)
  @IsNumber()
  price!: number;

  @IsOptional()
  @IsString()
  driverId?: string;

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
  baggageRequired?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  noAnimals?: boolean;
}

class UpdateIntercityOrderStatusDto {
  @IsEnum(IntercityOrderStatus)
  status!: IntercityOrderStatus;
}

@Controller('intercity-orders')
export class IntercityOrdersController {
  constructor(private readonly intercityOrdersService: IntercityOrdersService) {}

  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  getMyOrders(@Req() req: any) {
    return this.intercityOrdersService.getOrdersForPassenger(req.user.userId);
  }

  @Get('driver/my')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  getMyDriverOrders(@Req() req: any) {
    return this.intercityOrdersService.getOrdersForDriver(req.user.userId);
  }

  @Get('available')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  available(@Req() req: any) {
    return this.intercityOrdersService.listAvailableDriverOffers(req.user.userId, {
      fromCity: req.query?.fromCity,
      toCity: req.query?.toCity,
    });
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() dto: CreateIntercityOrderDto, @Req() req: any) {
    return this.intercityOrdersService.createOrderForPassenger(req.user.userId, {
      ...dto,
      departureAt: new Date(dto.departureAt),
    });
  }

  @Get('driver/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  getByIdForDriver(@Param('id') id: string, @Req() req: any) {
    return this.intercityOrdersService.getOrderByIdForDriver(req.user.userId, id);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  getById(@Param('id') id: string, @Req() req: any) {
    return this.intercityOrdersService.getOrderByIdForPassenger(req.user.userId, id);
  }

  @Post(':id/accept')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  accept(@Param('id') id: string, @Req() req: any) {
    return this.intercityOrdersService.acceptOrder(req.user.userId, id);
  }

  @Post(':id/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateIntercityOrderStatusDto, @Req() req: any) {
    return this.intercityOrdersService.updateOrderStatus(req.user.userId, id, dto.status);
  }

  @Post(':id/cancel')
  @UseGuards(AuthGuard('jwt'))
  cancelByPassenger(@Param('id') id: string, @Req() req: any) {
    return this.intercityOrdersService.cancelOrderByPassenger(req.user.userId, id);
  }

  @Post(':id/driver-cancel')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  cancelByDriver(@Param('id') id: string, @Req() req: any) {
    return this.intercityOrdersService.cancelOrderByDriver(req.user.userId, id);
  }
}
