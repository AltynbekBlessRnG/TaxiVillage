import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { AdminGuard } from './admin.guard';
import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramOtpService } from './telegram-otp.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET || 'dev-secret',
        signOptions: {
          expiresIn: '15m',
        },
      }),
    }),
    UsersModule,
    PrismaModule,
  ],
  providers: [AuthService, JwtStrategy, AdminGuard, TelegramOtpService],
  controllers: [AuthController],
  exports: [AdminGuard, JwtModule],
})
export class AuthModule {}

