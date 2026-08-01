import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard } from '@nestjs/passport';
import { FoodOrderStatus, PaymentMethod, UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { FoodOrdersService } from './food-orders.service';

class FoodOrderItemDto {
  @IsString()
  menuItemId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty!: number;
}

class CreateFoodOrderDto {
  @IsString()
  merchantId!: string;

  @IsString()
  @MaxLength(300)
  deliveryAddress!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  deliveryLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  deliveryLng?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FoodOrderItemDto)
  items!: FoodOrderItemDto[];

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsString()
  promoCode?: string;
}

class ValidatePromoCodeDto {
  @IsString()
  merchantId!: string;

  @IsString()
  promoCode!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FoodOrderItemDto)
  items!: FoodOrderItemDto[];
}

class UpdateFoodOrderStatusDto {
  @IsEnum(FoodOrderStatus)
  status!: FoodOrderStatus;
}

class CancelFoodOrderDto {
  @IsString()
  @MaxLength(300)
  reason!: string;
}

@Controller('food-orders')
@UseGuards(AuthGuard('jwt'))
export class FoodOrdersController {
  constructor(private readonly foodOrdersService: FoodOrdersService) {}

  @Get('my')
  getMyOrders(@Req() req: any) {
    return this.foodOrdersService.getOrdersForUser(req.user.userId, req.user.role);
  }

  @Get('driver/available')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER, UserRole.COURIER, UserRole.DRIVER_INTERCITY)
  getAvailableDeliveries(@Req() req: any) {
    return this.foodOrdersService.getAvailableDeliveries(req.user.userId);
  }

  @Get('driver/current')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER, UserRole.COURIER, UserRole.DRIVER_INTERCITY)
  getCurrentDelivery(@Req() req: any) {
    return this.foodOrdersService.getCurrentDelivery(req.user.userId);
  }

  @Post('validate-promo')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PASSENGER)
  validatePromo(@Body() dto: ValidatePromoCodeDto, @Req() req: any) {
    return this.foodOrdersService.validatePromoCode(req.user.userId, dto);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.PASSENGER)
  create(
    @Body() dto: CreateFoodOrderDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: any,
  ) {
    return this.foodOrdersService.createOrderForPassenger(
      req.user.userId,
      dto,
      idempotencyKey,
    );
  }

  @Get(':id')
  getById(@Param('id') id: string, @Req() req: any) {
    return this.foodOrdersService.getOrderByIdForUser(req.user.userId, req.user.role, id);
  }

  @Post(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateFoodOrderStatusDto,
    @Req() req: any,
  ) {
    return this.foodOrdersService.updateOrderStatusForMerchant(
      req.user.userId,
      id,
      dto.status,
    );
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelFoodOrderDto, @Req() req: any) {
    return this.foodOrdersService.cancelOrder(
      req.user.userId,
      req.user.role,
      id,
      dto.reason,
    );
  }

  @Post(':id/repeat')
  @UseGuards(RolesGuard)
  @Roles(UserRole.PASSENGER)
  repeat(
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: any,
  ) {
    return this.foodOrdersService.repeatOrder(
      req.user.userId,
      id,
      idempotencyKey,
    );
  }

  @Post(':id/claim')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER, UserRole.COURIER, UserRole.DRIVER_INTERCITY)
  claim(@Param('id') id: string, @Req() req: any) {
    return this.foodOrdersService.claimDelivery(req.user.userId, id);
  }

  @Post(':id/driver-status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER, UserRole.COURIER, UserRole.DRIVER_INTERCITY)
  updateDriverStatus(
    @Param('id') id: string,
    @Body() dto: UpdateFoodOrderStatusDto,
    @Req() req: any,
  ) {
    return this.foodOrdersService.updateDeliveryStatus(
      req.user.userId,
      id,
      dto.status,
    );
  }
}

@Controller('driver/food-deliveries')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.DRIVER, UserRole.COURIER, UserRole.DRIVER_INTERCITY)
export class DriverFoodDeliveriesController {
  constructor(private readonly foodOrdersService: FoodOrdersService) {}

  @Get('available')
  getAvailable(@Req() req: any) {
    return this.foodOrdersService.getAvailableDeliveries(req.user.userId);
  }

  @Get('current')
  getCurrent(@Req() req: any) {
    return this.foodOrdersService.getCurrentDelivery(req.user.userId);
  }

  @Post(':id/claim')
  claim(@Param('id') id: string, @Req() req: any) {
    return this.foodOrdersService.claimDelivery(req.user.userId, id);
  }

  @Post(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateFoodOrderStatusDto,
    @Req() req: any,
  ) {
    return this.foodOrdersService.updateDeliveryStatus(
      req.user.userId,
      id,
      dto.status,
    );
  }
}
