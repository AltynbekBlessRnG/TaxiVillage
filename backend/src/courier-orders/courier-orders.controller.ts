import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard } from '@nestjs/passport';
import { CourierOrderStatus, UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CourierOrdersService } from './courier-orders.service';

class CreateCourierOrderDto {
  @IsString()
  pickupAddress!: string;

  @IsString()
  dropoffAddress!: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pickupLat?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pickupLng?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  dropoffLat?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  dropoffLng?: number;

  @IsString()
  itemDescription!: string;

  @IsOptional()
  @IsString()
  packageWeight?: string;

  @IsOptional()
  @IsString()
  packageSize?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  estimatedPrice?: number;
}

class UpdateCourierOrderStatusDto {
  @IsEnum(CourierOrderStatus)
  status!: CourierOrderStatus;
}

@Controller('courier-orders')
export class CourierOrdersController {
  constructor(private readonly courierOrdersService: CourierOrdersService) {}

  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  getMyOrders(@Req() req: any) {
    return this.courierOrdersService.getOrdersForUser(req.user.userId, req.user.role);
  }

  @Get('available')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.COURIER)
  getAvailable(@Req() req: any) {
    return this.courierOrdersService.getAvailableOrdersForCourier(req.user.userId);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.PASSENGER)
  create(@Body() dto: CreateCourierOrderDto, @Req() req: any) {
    return this.courierOrdersService.createOrderForPassenger(req.user.userId, dto);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  getById(@Param('id') id: string, @Req() req: any) {
    return this.courierOrdersService.getOrderByIdForUser(req.user.userId, req.user.role, id);
  }

  @Post(':id/cancel')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.PASSENGER)
  cancel(@Param('id') id: string, @Req() req: any) {
    return this.courierOrdersService.cancelOrderByPassenger(req.user.userId, id);
  }

  @Post(':id/accept')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.COURIER)
  accept(@Param('id') id: string, @Req() req: any) {
    return this.courierOrdersService.acceptOrder(req.user.userId, id);
  }

  @Post(':id/reject')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.COURIER)
  reject(@Param('id') id: string, @Req() req: any) {
    return this.courierOrdersService.rejectOrder(req.user.userId, id);
  }

  @Post(':id/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.COURIER)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateCourierOrderStatusDto, @Req() req: any) {
    return this.courierOrdersService.updateOrderStatus(req.user.userId, id, dto.status);
  }
}
