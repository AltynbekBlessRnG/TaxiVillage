import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';
import { MerchantsService } from './merchants.service';

class UpdateMerchantProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  cuisine?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  etaMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minOrder?: number;

  @IsOptional()
  @IsString()
  tone?: string;

  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;
}

class CreateCategoryDto {
  @IsString()
  name!: string;
}

class CreateMenuItemDto {
  @IsString()
  categoryId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  price!: number;
}

@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Get('public')
  listPublic() {
    return this.merchantsService.listPublicMerchants();
  }

  @Get(':id/menu')
  getMenu(@Param('id') id: string) {
    return this.merchantsService.getMerchantMenu(id);
  }

  @Get('profile/me')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.MERCHANT)
  getProfile(@Req() req: any) {
    return this.merchantsService.getProfile(req.user.userId);
  }

  @Patch('profile/me')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.MERCHANT)
  updateProfile(@Body() dto: UpdateMerchantProfileDto, @Req() req: any) {
    return this.merchantsService.updateProfile(req.user.userId, dto);
  }

  @Post('menu/categories')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.MERCHANT)
  createCategory(@Body() dto: CreateCategoryDto, @Req() req: any) {
    return this.merchantsService.createCategory(req.user.userId, dto);
  }

  @Post('menu/items')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.MERCHANT)
  createItem(@Body() dto: CreateMenuItemDto, @Req() req: any) {
    return this.merchantsService.createMenuItem(req.user.userId, dto);
  }

  @Get('orders/me')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.MERCHANT)
  getOrders(@Req() req: any) {
    return this.merchantsService.listMerchantOrders(req.user.userId);
  }
}
