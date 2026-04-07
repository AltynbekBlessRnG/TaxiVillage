import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MinLength,
} from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client/index';
import { AuthService } from './auth.service';

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

class VerifyCodeDto {
  @IsString()
  sessionId!: string;

  @IsString()
  @MinLength(4)
  code!: string;
}

class CompleteVerificationDto {
  @IsString()
  verificationToken!: string;
}

class ResendCodeDto {
  @IsString()
  sessionId!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('register/start')
  startRegister(@Body() dto: RegisterDto) {
    return this.authService.startRegisterVerification(dto);
  }

  @Post('register/complete')
  completeRegister(@Body() dto: CompleteVerificationDto) {
    return this.authService.completeRegister(dto.verificationToken);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.phone, dto.password);
  }

  @Post('login/start')
  startLogin(@Body() dto: LoginDto) {
    return this.authService.startLoginVerification(dto);
  }

  @Post('login/complete')
  completeLogin(@Body() dto: CompleteVerificationDto) {
    return this.authService.completeLogin(dto.verificationToken);
  }

  @Post('verify-code')
  verifyCode(@Body() dto: VerifyCodeDto) {
    return this.authService.verifyCode(dto.sessionId, dto.code);
  }

  @Post('otp/resend')
  resendCode(@Body() dto: ResendCodeDto) {
    return this.authService.resendCode(dto.sessionId);
  }

  @Post('telegram/webhook')
  telegramWebhook(@Body() update: any) {
    return this.authService.handleTelegramWebhook(update);
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
