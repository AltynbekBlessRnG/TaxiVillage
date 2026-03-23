import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
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
    return this.intercityOrdersService.getOrdersForUser(req.user.userId, req.user.role);
  }

  @Get('available')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER_INTERCITY)
  available(@Req() req: any) {
    return this.intercityOrdersService.listAvailableDriverOffers(req.user.userId);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.PASSENGER)
  create(@Body() dto: CreateIntercityOrderDto, @Req() req: any) {
    return this.intercityOrdersService.createOrderForPassenger(req.user.userId, {
      ...dto,
      departureAt: new Date(dto.departureAt),
    });
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  getById(@Param('id') id: string, @Req() req: any) {
    return this.intercityOrdersService.getOrderByIdForUser(req.user.userId, req.user.role, id);
  }

  @Post(':id/accept')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER_INTERCITY)
  accept(@Param('id') id: string, @Req() req: any) {
    return this.intercityOrdersService.acceptOrder(req.user.userId, id);
  }

  @Post(':id/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER_INTERCITY)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateIntercityOrderStatusDto, @Req() req: any) {
    return this.intercityOrdersService.updateOrderStatus(req.user.userId, id, dto.status);
  }
}
