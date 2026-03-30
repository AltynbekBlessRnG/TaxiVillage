import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard } from '@nestjs/passport';
import { FoodOrderStatus, UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { FoodOrdersService } from './food-orders.service';

class FoodOrderItemDto {
  @IsString()
  menuItemId!: string;

  @Type(() => Number)
  qty!: number;
}

class CreateFoodOrderDto {
  @IsString()
  merchantId!: string;

  @IsString()
  deliveryAddress!: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FoodOrderItemDto)
  items!: FoodOrderItemDto[];

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

@Controller('food-orders')
export class FoodOrdersController {
  constructor(private readonly foodOrdersService: FoodOrdersService) {}

  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  getMyOrders(@Req() req: any) {
    return this.foodOrdersService.getOrdersForUser(req.user.userId, req.user.role);
  }

  @Post('validate-promo')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.PASSENGER)
  validatePromo(@Body() dto: ValidatePromoCodeDto) {
    return this.foodOrdersService.validatePromoCode(dto);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.PASSENGER)
  create(@Body() dto: CreateFoodOrderDto, @Req() req: any) {
    return this.foodOrdersService.createOrderForPassenger(req.user.userId, dto);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  getById(@Param('id') id: string, @Req() req: any) {
    return this.foodOrdersService.getOrderByIdForUser(req.user.userId, req.user.role, id);
  }

  @Post(':id/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.MERCHANT)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateFoodOrderStatusDto, @Req() req: any) {
    return this.foodOrdersService.updateOrderStatusForMerchant(req.user.userId, id, dto.status);
  }
}
