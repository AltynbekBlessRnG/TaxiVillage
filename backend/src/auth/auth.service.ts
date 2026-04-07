import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PhoneOtpPurpose, Prisma, UserRole } from '@prisma/client/index';
import { randomInt, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { TelegramOtpService } from './telegram-otp.service';

type PublicRegisterRole = 'PASSENGER' | 'DRIVER' | 'MERCHANT';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  tokenType: 'access' | 'refresh';
}

type VerificationSessionResponse = {
  sessionId: string;
  expiresAt: string;
  telegramBotUrl: string | null;
  resendAfterSeconds: number;
  debugCode?: string;
};

@Injectable()
export class AuthService {
  private readonly otpTtlMinutes: number;
  private readonly otpResendSeconds: number;
  private readonly maxAttempts = 5;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly telegramOtpService: TelegramOtpService,
  ) {
    this.otpTtlMinutes = Number(this.configService.get('OTP_TTL_MINUTES') || 10);
    this.otpResendSeconds = Number(this.configService.get('OTP_RESEND_SECONDS') || 45);
  }

  async register(input: {
    phone: string;
    email?: string;
    password: string;
    role: PublicRegisterRole;
    fullName?: string;
  }) {
    return this.startRegisterVerification(input);
  }

  async login(phone: string, password: string) {
    let user = await this.usersService.findByPhone(phone);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.role === 'ADMIN') {
      const tokens = await this.issueTokens(user.id, user.role);
      return { user: this.toSafeUser(user), ...tokens };
    }

    throw new BadRequestException('Используйте подтверждение номера через Telegram.');
  }

  async startRegisterVerification(input: {
    phone: string;
    email?: string;
    password: string;
    role: PublicRegisterRole;
    fullName?: string;
  }) {
    const existingUser = await this.usersService.findByPhone(input.phone);
    if (existingUser) {
      throw new BadRequestException(
        'Пользователь с таким номером телефона уже существует. Попробуйте войти.',
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const session = await this.createOtpSession({
      phone: input.phone,
      purpose: PhoneOtpPurpose.REGISTER,
      payload: {
        phone: input.phone,
        email: input.email,
        passwordHash,
        role: input.role,
        fullName: input.fullName,
      },
    });

    return this.buildSessionResponse(session);
  }

  async startLoginVerification(input: { phone: string; password: string }) {
    let user = await this.usersService.findByPhone(input.phone);
    if (!user) {
      throw new UnauthorizedException('Неверный телефон или пароль');
    }

    const valid = await bcrypt.compare(input.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Неверный телефон или пароль');
    }

    user = await this.normalizeLegacyUser(user.id, user.role);
    if (!user) {
      throw new UnauthorizedException('Неверный телефон или пароль');
    }

    const session = await this.createOtpSession({
      phone: input.phone,
      purpose: PhoneOtpPurpose.LOGIN,
      payload: {
        userId: user.id,
        role: user.role,
      },
    });

    return this.buildSessionResponse(session);
  }

  async resendCode(sessionId: string) {
    const session = await this.prisma.phoneOtpSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.usedAt) {
      throw new BadRequestException('Сессия подтверждения не найдена');
    }

    if (
      session.telegramDeliveredAt &&
      Date.now() - session.telegramDeliveredAt.getTime() < this.otpResendSeconds * 1000
    ) {
      throw new BadRequestException(
        `Подождите ${this.otpResendSeconds} сек. перед повторной отправкой кода.`,
      );
    }

    const refreshed = await this.rotateSessionCode(session.id);
    if (refreshed.telegramChatId) {
      const delivered = await this.telegramOtpService.sendCode(
        refreshed.telegramChatId,
        refreshed.code,
        refreshed.phone,
      );
      if (delivered) {
        await this.prisma.phoneOtpSession.update({
          where: { id: refreshed.id },
          data: { telegramDeliveredAt: new Date() },
        });
      }
    }

    return this.buildSessionResponse(refreshed);
  }

  async verifyCode(sessionId: string, code: string) {
    const session = await this.prisma.phoneOtpSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.usedAt) {
      throw new BadRequestException('Сессия подтверждения не найдена');
    }

    if (session.verifiedAt) {
      return {
        verificationToken: session.verificationToken,
      };
    }

    if (session.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Код истек. Отправьте новый код.');
    }

    if (session.attempts >= this.maxAttempts) {
      throw new BadRequestException('Превышено количество попыток. Запросите новый код.');
    }

    if (session.code !== code.trim()) {
      await this.prisma.phoneOtpSession.update({
        where: { id: session.id },
        data: {
          attempts: { increment: 1 },
        },
      });
      throw new BadRequestException('Неверный код подтверждения');
    }

    const verificationToken = randomUUID();
    await this.prisma.phoneOtpSession.update({
      where: { id: session.id },
      data: {
        verifiedAt: new Date(),
        verificationToken,
        attempts: { increment: 1 },
      },
    });

    return { verificationToken };
  }

  async completeRegister(verificationToken: string) {
    const session = await this.prisma.phoneOtpSession.findUnique({
      where: { verificationToken },
    });

    if (!session || session.usedAt || !session.verifiedAt || session.purpose !== PhoneOtpPurpose.REGISTER) {
      throw new BadRequestException('Подтверждение не найдено или уже использовано');
    }

    const payload = (session.payload || {}) as Prisma.JsonObject;
    const user = await this.usersService.createUserWithProfile({
      phone: String(payload.phone || session.phone),
      email: payload.email ? String(payload.email) : undefined,
      passwordHash: String(payload.passwordHash || ''),
      role: String(payload.role || 'PASSENGER') as UserRole,
      fullName: payload.fullName ? String(payload.fullName) : undefined,
      phoneVerifiedAt: new Date(),
    });

    await this.prisma.phoneOtpSession.update({
      where: { id: session.id },
      data: { usedAt: new Date() },
    });

    const tokens = await this.issueTokens(user.id, user.role);
    return { user: this.toSafeUser(user), ...tokens };
  }

  async completeLogin(verificationToken: string) {
    const session = await this.prisma.phoneOtpSession.findUnique({
      where: { verificationToken },
    });

    if (!session || session.usedAt || !session.verifiedAt || session.purpose !== PhoneOtpPurpose.LOGIN) {
      throw new BadRequestException('Подтверждение не найдено или уже использовано');
    }

    const payload = (session.payload || {}) as Prisma.JsonObject;
    const payloadUserId = payload.userId ? String(payload.userId) : '';
    let user = payloadUserId ? await this.usersService.findOne(payloadUserId) : null;

    if (!user) {
      const fallbackUser = await this.usersService.findByPhone(session.phone);
      if (!fallbackUser) {
        throw new UnauthorizedException('Пользователь не найден');
      }
      user = await this.usersService.findOne(fallbackUser.id);
    }

    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }

    const normalizedUser = await this.normalizeLegacyUser(user.id, user.role);
    if (!normalizedUser) {
      throw new UnauthorizedException('Пользователь не найден');
    }

    await this.usersService.markPhoneVerified(normalizedUser.id);
    await this.prisma.phoneOtpSession.update({
      where: { id: session.id },
      data: { usedAt: new Date() },
    });

    const tokens = await this.issueTokens(normalizedUser.id, normalizedUser.role);
    return { user: this.toSafeUser(normalizedUser), ...tokens };
  }

  async handleTelegramWebhook(update: any) {
    const messageText = update?.message?.text?.trim();
    const chatId = update?.message?.chat?.id?.toString();

    if (!messageText || !chatId) {
      return { ok: true };
    }

    if (messageText.startsWith('/start otp_')) {
      const sessionId = messageText.replace('/start otp_', '').trim();
      const session = await this.prisma.phoneOtpSession.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.usedAt) {
        await this.telegramOtpService.sendText(
          chatId,
          'Сессия подтверждения не найдена или уже закрыта. Вернитесь в приложение и запросите новый код.',
        );
        return { ok: true };
      }

      const refreshed = await this.rotateSessionCode(session.id, { telegramChatId: chatId });
      const delivered = await this.telegramOtpService.sendCode(chatId, refreshed.code, refreshed.phone);

      if (delivered) {
        await this.prisma.phoneOtpSession.update({
          where: { id: refreshed.id },
          data: { telegramDeliveredAt: new Date(), telegramChatId: chatId },
        });
      }

      return { ok: true };
    }

    return { ok: true };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken);
      if (payload.tokenType !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.usersService.findAuthUserById(payload.sub);
      if (!user?.refreshTokenHash || user.isDeleted) {
        throw new UnauthorizedException('Refresh token revoked');
      }

      const valid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (!valid) {
        throw new UnauthorizedException('Refresh token revoked');
      }

      const refreshedUser = await this.usersService.findOne(payload.sub);
      if (!refreshedUser) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const normalizedUser = await this.normalizeLegacyUser(refreshedUser.id, refreshedUser.role);
      return this.issueTokens(payload.sub, (normalizedUser?.role ?? refreshedUser.role) as UserRole);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async revokeRefreshToken(userId: string) {
    await this.usersService.updateRefreshTokenHash(userId, null);
  }

  private async createOtpSession(params: {
    phone: string;
    purpose: PhoneOtpPurpose;
    payload: Prisma.JsonObject;
  }) {
    await this.prisma.phoneOtpSession.updateMany({
      where: {
        phone: params.phone,
        purpose: params.purpose,
        usedAt: null,
        verifiedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    const code = this.generateCode();
    return this.prisma.phoneOtpSession.create({
      data: {
        phone: params.phone,
        purpose: params.purpose,
        code,
        expiresAt: this.buildExpiryDate(),
        payload: params.payload,
      },
    });
  }

  private buildSessionResponse(session: {
    id: string;
    code: string;
    expiresAt: Date;
  }): VerificationSessionResponse {
    const response: VerificationSessionResponse = {
      sessionId: session.id,
      expiresAt: session.expiresAt.toISOString(),
      telegramBotUrl: this.telegramOtpService.buildStartUrl(session.id),
      resendAfterSeconds: this.otpResendSeconds,
    };

    if (this.configService.get('NODE_ENV') !== 'production') {
      response.debugCode = session.code;
    }

    return response;
  }

  private async rotateSessionCode(sessionId: string, extraData?: Partial<{
    telegramChatId: string;
  }>) {
    return this.prisma.phoneOtpSession.update({
      where: { id: sessionId },
      data: {
        code: this.generateCode(),
        expiresAt: this.buildExpiryDate(),
        attempts: 0,
        verificationToken: null,
        verifiedAt: null,
        ...(extraData?.telegramChatId ? { telegramChatId: extraData.telegramChatId } : {}),
      },
    });
  }

  private buildExpiryDate() {
    return new Date(Date.now() + this.otpTtlMinutes * 60 * 1000);
  }

  private generateCode() {
    return randomInt(100000, 999999).toString();
  }

  private async normalizeLegacyUser(userId: string, role: UserRole) {
    if (role === 'DRIVER_INTERCITY') {
      return this.usersService.upgradeLegacyIntercityDriver(userId);
    }

    if (role === 'COURIER') {
      return this.usersService.upgradeLegacyCourier(userId);
    }

    if (role === 'DRIVER') {
      return this.usersService.ensureUnifiedDriverProfile(userId);
    }

    return this.usersService.findByPhone(
      (await this.usersService.findOne(userId))?.phone || '',
    ) as any;
  }

  private async issueTokens(userId: string, role: UserRole) {
    const accessToken = this.jwtService.sign(
      { sub: userId, role, tokenType: 'access' } satisfies JwtPayload,
      {
        expiresIn: '15m',
      },
    );
    const refreshToken = this.jwtService.sign(
      { sub: userId, role, tokenType: 'refresh' } satisfies JwtPayload,
      {
        expiresIn: '7d',
      },
    );
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.usersService.updateRefreshTokenHash(userId, refreshTokenHash);

    return { accessToken, refreshToken };
  }

  private toSafeUser(user: any) {
    const { password: _password, refreshTokenHash: _refreshTokenHash, ...safeUser } = user;
    return safeUser;
  }
}
