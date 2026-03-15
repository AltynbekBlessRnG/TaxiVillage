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
import { Type } from 'class-transformer';
import { diskStorage } from 'multer';
import { DriversService } from './drivers.service';
import { UploadService } from '../upload/upload.service';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DocumentType, UserRole } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// Ensure temp directory exists
const TEMP_DIR = path.join(process.cwd(), 'uploads/temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

class SetStatusDto {
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

const uploadOpts = {
  storage: diskStorage({
    destination: (req: any, file: any, cb: any) => {
      cb(null, TEMP_DIR);
    },
    filename: (req: any, file: any, cb: any) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = file.originalname.split('.').pop();
      cb(null, `doc-${uniqueSuffix}.${ext}`);
    },
  }),
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
    const userId: string = req.user.userId;
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = parseFloat(req.query.radius as string) || 5;
    
    if (!lat || !lng) {
      throw new BadRequestException('lat and lng are required');
    }
    
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
    const url = this.uploadService.saveFile(file, `doc-${userId}`);
    return this.driversService.addDocument(userId, dto.type, url);
  }
}

