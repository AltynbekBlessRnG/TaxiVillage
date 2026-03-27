import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsIn, IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { UserRole } from '@prisma/client/index';
import { AuthGuard } from '@nestjs/passport';

type PublicRegisterRole = 'PASSENGER' | 'DRIVER' | 'MERCHANT';

class RegisterDto {
  @IsPhoneNumber()
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsIn([UserRole.PASSENGER, UserRole.DRIVER, UserRole.MERCHANT])
  role!: PublicRegisterRole;

  @IsOptional()
  @IsString()
  fullName?: string;
}

class LoginDto {
  @IsPhoneNumber()
  phone!: string;

  @IsString()
  password!: string;
}

class RefreshDto {
  @IsString()
  refreshToken!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.phone, dto.password);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  async logout(@Req() req: any) {
    await this.authService.revokeRefreshToken(req.user.userId);
    return { success: true };
  }
}

