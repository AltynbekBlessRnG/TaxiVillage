import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '@prisma/client';
import { TariffsService } from './tariffs.service';

class CreateTariffDto {
  @IsString()
  name!: string;

  @IsNumber()
  @Type(() => Number)
  baseFare!: number;

  @IsNumber()
  @Type(() => Number)
  pricePerKm!: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pricePerMinute?: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

class UpdateTariffDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  baseFare?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pricePerKm?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pricePerMinute?: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

@Controller('tariffs')
export class TariffsController {
  constructor(private readonly tariffsService: TariffsService) {}

  @Get()
  findAll() {
    return this.tariffsService.findAll();
  }

  @Get('active')
  findActive() {
    return this.tariffsService.findActive();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tariffsService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateTariffDto) {
    return this.tariffsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateTariffDto) {
    return this.tariffsService.update(id, dto);
  }
}
