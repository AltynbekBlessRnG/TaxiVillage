import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsOptional, IsString } from 'class-validator';
import { UsersService } from './users.service';

class PushTokenDto {
  @IsOptional()
  @IsString()
  pushToken?: string | null;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
}
