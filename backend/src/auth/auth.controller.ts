import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
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

  private resolveClientKey(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
      return forwarded.split(',')[0]?.trim() || req.ip || 'unknown';
    }
    return req.ip || 'unknown';
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('register/start')
  startRegister(@Req() req: Request, @Body() dto: RegisterDto) {
    this.authService.enforceRateLimit({
      bucket: 'auth-register-start',
      key: this.resolveClientKey(req),
      limit: 5,
      windowMs: 60_000,
    });
    return this.authService.startRegisterVerification(dto);
  }

  @Post('register/complete')
  completeRegister(@Body() dto: CompleteVerificationDto) {
    return this.authService.completeRegister(dto.verificationToken);
  }

  @Post('login')
  login(@Req() req: Request, @Body() dto: LoginDto) {
    this.authService.enforceRateLimit({
      bucket: 'auth-login',
      key: this.resolveClientKey(req),
      limit: 10,
      windowMs: 60_000,
    });
    return this.authService.login(dto.phone, dto.password);
  }

  @Post('login/start')
  startLogin(@Req() req: Request, @Body() dto: LoginDto) {
    this.authService.enforceRateLimit({
      bucket: 'auth-login-start',
      key: this.resolveClientKey(req),
      limit: 6,
      windowMs: 60_000,
    });
    return this.authService.startLoginVerification(dto);
  }

  @Post('login/complete')
  completeLogin(@Body() dto: CompleteVerificationDto) {
    return this.authService.completeLogin(dto.verificationToken);
  }

  @Post('verify-code')
  verifyCode(@Req() req: Request, @Body() dto: VerifyCodeDto) {
    this.authService.enforceRateLimit({
      bucket: 'auth-verify-code',
      key: this.resolveClientKey(req),
      limit: 10,
      windowMs: 60_000,
    });
    return this.authService.verifyCode(dto.sessionId, dto.code);
  }

  @Post('otp/resend')
  resendCode(@Req() req: Request, @Body() dto: ResendCodeDto) {
    this.authService.enforceRateLimit({
      bucket: 'auth-otp-resend',
      key: this.resolveClientKey(req),
      limit: 5,
      windowMs: 60_000,
    });
    return this.authService.resendCode(dto.sessionId);
  }

  @Post('telegram/webhook')
  telegramWebhook(
    @Req() req: Request,
    @Body() update: any,
  ) {
    this.authService.validateTelegramWebhookSecret(
      req.header('x-telegram-bot-api-secret-token') || undefined,
    );
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
