import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { FavoriteAddressesService } from './favorite-addresses.service';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';

class CreateFavoriteAddressDto {
  @IsString()
  name!: string;

  @IsString()
  address!: string;

  @IsNumber()
  @Type(() => Number)
  lat!: number;

  @IsNumber()
  @Type(() => Number)
  lng!: number;
}

class UpdateFavoriteAddressDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lng?: number;
}

@Controller('favorite-addresses')
export class FavoriteAddressesController {
  constructor(private readonly favoriteAddressesService: FavoriteAddressesService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.PASSENGER)
  async getFavoriteAddresses(@Req() req: any) {
    const userId: string = req.user.userId;
    return this.favoriteAddressesService.getFavoriteAddresses(userId);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.PASSENGER)
  async createFavoriteAddress(
    @Body() data: CreateFavoriteAddressDto,
    @Req() req: any,
  ) {
    const userId: string = req.user.userId;
    return this.favoriteAddressesService.createFavoriteAddress(userId, data);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.PASSENGER)
  async updateFavoriteAddress(
    @Body() data: UpdateFavoriteAddressDto,
    @Req() req: any,
  ) {
    const userId: string = req.user.userId;
    const addressId: string = req.params.id;
    return this.favoriteAddressesService.updateFavoriteAddress(userId, addressId, data);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.PASSENGER)
  async deleteFavoriteAddress(@Req() req: any) {
    const userId: string = req.user.userId;
    const addressId: string = req.params.id;
    return this.favoriteAddressesService.deleteFavoriteAddress(userId, addressId);
  }
}
