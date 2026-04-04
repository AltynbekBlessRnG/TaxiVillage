import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { memoryStorage } from 'multer';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';
import { MerchantsService } from './merchants.service';
import { UploadService } from '../upload/upload.service';

class UpdateMerchantProfileDto {
  @IsOptional()
  @IsString()
  whatsAppPhone?: string;

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
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;
}

class CreateCategoryDto {
  @IsString()
  name!: string;
}

class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;
}

class ReorderDto {
  @IsString()
  direction!: 'up' | 'down';
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

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

class UpdateMenuItemDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

const uploadOpts = {
  storage: memoryStorage(),
};

@Controller('merchants')
export class MerchantsController {
  constructor(
    private readonly merchantsService: MerchantsService,
    private readonly uploadService: UploadService,
  ) {}

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

  @Post('profile/cover-image')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.MERCHANT)
  @UseInterceptors(FileInterceptor('file', uploadOpts))
  uploadCoverImage(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const url = this.uploadService.saveFile(file, `merchant-cover-${req.user.userId}`);
    return { url };
  }

  @Post('menu/categories')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.MERCHANT)
  createCategory(@Body() dto: CreateCategoryDto, @Req() req: any) {
    return this.merchantsService.createCategory(req.user.userId, dto);
  }

  @Patch('menu/categories/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.MERCHANT)
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto, @Req() req: any) {
    return this.merchantsService.updateCategory(req.user.userId, id, dto);
  }

  @Delete('menu/categories/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.MERCHANT)
  deleteCategory(@Param('id') id: string, @Req() req: any) {
    return this.merchantsService.deleteCategory(req.user.userId, id);
  }

  @Post('menu/categories/:id/reorder')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.MERCHANT)
  reorderCategory(@Param('id') id: string, @Body() dto: ReorderDto, @Req() req: any) {
    return this.merchantsService.reorderCategory(req.user.userId, id, dto.direction);
  }

  @Post('menu/items')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.MERCHANT)
  createItem(@Body() dto: CreateMenuItemDto, @Req() req: any) {
    return this.merchantsService.createMenuItem(req.user.userId, dto);
  }

  @Patch('menu/items/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.MERCHANT)
  updateItem(@Param('id') id: string, @Body() dto: UpdateMenuItemDto, @Req() req: any) {
    return this.merchantsService.updateMenuItem(req.user.userId, id, dto);
  }

  @Delete('menu/items/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.MERCHANT)
  deleteItem(@Param('id') id: string, @Req() req: any) {
    return this.merchantsService.deleteMenuItem(req.user.userId, id);
  }

  @Post('menu/items/:id/reorder')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.MERCHANT)
  reorderItem(@Param('id') id: string, @Body() dto: ReorderDto, @Req() req: any) {
    return this.merchantsService.reorderMenuItem(req.user.userId, id, dto.direction);
  }

  @Post('menu/items/image')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.MERCHANT)
  @UseInterceptors(FileInterceptor('file', uploadOpts))
  uploadMenuItemImage(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const url = this.uploadService.saveFile(file, `merchant-item-${req.user.userId}`);
    return { url };
  }

  @Get('orders/me')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.MERCHANT)
  getOrders(@Req() req: any) {
    return this.merchantsService.listMerchantOrders(req.user.userId);
  }
}
