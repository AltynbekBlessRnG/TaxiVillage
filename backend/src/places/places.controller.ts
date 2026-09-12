import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsLatitude, IsLongitude, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PlacesService } from './places.service';

class NearestPlaceQueryDto {
  @Type(() => Number)
  @IsLatitude({ message: 'Некорректная широта' })
  lat!: number;

  @Type(() => Number)
  @IsLongitude({ message: 'Некорректная долгота' })
  lng!: number;
}

class SearchPlacesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}

@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get('nearest')
  @UseGuards(AuthGuard('jwt'))
  findNearest(@Query() query: NearestPlaceQueryDto) {
    return this.placesService.findNearest(query.lat, query.lng);
  }

  @Get('search')
  @UseGuards(AuthGuard('jwt'))
  search(@Query() query: SearchPlacesQueryDto) {
    return this.placesService.search(query.q ?? '');
  }
}
