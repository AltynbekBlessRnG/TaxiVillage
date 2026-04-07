import { BadRequestException, Body, Controller, Delete, Get, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { IsOptional, IsString } from 'class-validator';
import { memoryStorage } from 'multer';
import { UsersService } from './users.service';
import { UploadService } from '../upload/upload.service';

class PushTokenDto {
  @IsOptional()
  @IsString()
  pushToken?: string | null;
}

const uploadOpts = {
  storage: memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!file.mimetype.startsWith('image/')) {
      callback(new BadRequestException('Only image uploads are allowed') as unknown as Error, false);
      return;
    }

    callback(null, true);
  },
};

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly uploadService: UploadService,
  ) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getMe(@Req() req: any) {
    const user = await this.usersService.findOne(req.user.userId);
    return user;
  }

  @Post('push-token')
  @UseGuards(AuthGuard('jwt'))
  async savePushToken(@Req() req: any, @Body() dto: PushTokenDto) {
    await this.usersService.updatePushToken(req.user.userId, dto.pushToken ?? null);
    return { success: true };
  }

  @Post('avatar')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('file', uploadOpts))
  async uploadAvatar(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const url = await this.uploadService.saveFile(file, `user-avatar-${req.user.userId}`);
    await this.usersService.updateAvatar(req.user.userId, url);
    return { url };
  }

  @Delete('me')
  @UseGuards(AuthGuard('jwt'))
  async deleteMe(@Req() req: any) {
    return this.usersService.deleteCurrentUser(req.user.userId);
  }
}
