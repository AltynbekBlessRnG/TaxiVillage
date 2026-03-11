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
import { memoryStorage, diskStorage } from 'multer';
import { DriversService } from './drivers.service';
import { UploadService } from '../upload/upload.service';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DocumentType, UserRole } from '@prisma/client';

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
    destination: (req, file, cb) => {
      cb(null, 'uploads/temp'); // Temporary folder for uploads
    },
    filename: (req, file, cb) => {
      // Generate unique filename to prevent collisions
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = file.originalname.split('.').pop();
      cb(null, `doc-${uniqueSuffix}.${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
  fileFilter: (req, file, cb) => {
    // Only allow image files for documents
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new BadRequestException('Only image files are allowed'));
    }
  },
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

