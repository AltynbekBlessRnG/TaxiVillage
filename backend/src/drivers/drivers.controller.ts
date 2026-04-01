import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsBoolean, IsEnum, IsNumber, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { memoryStorage } from 'multer'; // ИЗМЕНЕНО: используем память вместо диска
import { DriversService } from './drivers.service';
import { UploadService } from '../upload/upload.service';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CourierTransportType, DocumentType, DriverMode, UserRole } from '@prisma/client/index';

class SetStatusDto {
  @Transform(({ value }) => {
    if (value === true || value === false) {
      return value;
    }
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') {
        return true;
      }
      if (value.toLowerCase() === 'false') {
        return false;
      }
    }
    return value;
  })
  @IsBoolean()
  isOnline!: boolean;
}

class UpdateLocationDto {
  @IsNumber()
  @Type(() => Number)
  lat!: number;
  @IsNumber()
  @Type(() => Number)
  lng!: number;
}

class CarDto {
  @IsString()
  make!: string;
  @IsString()
  model!: string;
  @IsString()
  color!: string;
  @IsString()
  plateNumber!: string;
}

class AddDocumentDto {
  @IsEnum(DocumentType)
  type!: DocumentType;
}

class SetDriverModeDto {
  @IsEnum(DriverMode)
  driverMode!: DriverMode;
}

class SetIntercityCapabilityDto {
  @IsBoolean()
  supportsIntercity!: boolean;
}

class SetCourierCapabilityDto {
  @IsBoolean()
  supportsCourier!: boolean;

  @IsEnum(CourierTransportType)
  @Type(() => String)
  courierTransportType!: CourierTransportType;
}

class UpdateDriverProfileDto {
  @IsString()
  fullName!: string;
}

// ИЗМЕНЕНО: Простая настройка для хранения файла в буфере
const uploadOpts = {
  storage: memoryStorage(),
};

@Controller('drivers')
export class DriversController {
  constructor(
    private readonly driversService: DriversService,
    private readonly uploadService: UploadService,
  ) {}

  @Post('status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  setStatus(@Body() dto: SetStatusDto, @Req() req: any) {
    const userId: string = req.user.userId;
    return this.driversService.setOnlineStatus(userId, dto.isOnline);
  }

  @Patch('location')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  updateLocation(@Body() dto: UpdateLocationDto, @Req() req: any) {
    const userId: string = req.user.userId;
    return this.driversService.updateLocation(userId, dto.lat, dto.lng);
  }

  @Get('current-ride')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  currentRide(@Req() req: any) {
    const userId: string = req.user.userId;
    return this.driversService.getCurrentRideForDriver(userId);
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  getProfile(@Req() req: any) {
    const userId: string = req.user.userId;
    return this.driversService.getProfile(userId);
  }

  @Patch('profile')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  updateProfile(@Body() dto: UpdateDriverProfileDto, @Req() req: any) {
    const userId: string = req.user.userId;
    return this.driversService.updateProfile(userId, dto);
  }

  @Get('metrics')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  getMetrics(@Req() req: any) {
    const userId: string = req.user.userId;
    const days = Number(req.query.days ?? 7);
    return this.driversService.getMetrics(userId, days);
  }

  @Post('mode')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  setMode(@Body() dto: SetDriverModeDto, @Req() req: any) {
    const userId: string = req.user.userId;
    return this.driversService.setDriverMode(userId, dto.driverMode);
  }

  @Post('intercity-capability')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  setIntercityCapability(@Body() dto: SetIntercityCapabilityDto, @Req() req: any) {
    const userId: string = req.user.userId;
    return this.driversService.updateIntercityCapability(userId, dto.supportsIntercity);
  }

  @Post('courier-capability')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  setCourierCapability(@Body() dto: SetCourierCapabilityDto, @Req() req: any) {
    const userId: string = req.user.userId;
    return this.driversService.updateCourierCapability(userId, dto);
  }

  @Post('car')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  upsertCar(@Body() dto: CarDto, @Req() req: any) {
    const userId: string = req.user.userId;
    return this.driversService.upsertCar(userId, dto);
  }

  @Get('nearby')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.PASSENGER)
  getNearbyDrivers(@Req() req: any) {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = parseFloat(req.query.radius as string) || 5;
    if (!lat || !lng) throw new BadRequestException('lat and lng are required');
    return this.driversService.getNearbyDrivers(lat, lng, radius);
  }

  @Post('documents')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER)
  @UseInterceptors(FileInterceptor('file', uploadOpts))
  async addDocument(
    @Body() dto: AddDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const userId: string = req.user.userId;
    if (!file) {
      throw new BadRequestException('File is required');
    }
    // Теперь file.buffer существует, и UploadService сможет его сохранить
    const url = this.uploadService.saveFile(file, `doc-${userId}`);
    return this.driversService.addDocument(userId, dto.type, url);
  }
}
