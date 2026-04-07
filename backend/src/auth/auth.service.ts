import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { UserRole } from '@prisma/client/index';

type PublicRegisterRole = 'PASSENGER' | 'DRIVER' | 'MERCHANT';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  tokenType: 'access' | 'refresh';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(input: {
    phone: string;
    email?: string;
    password: string;
    role: PublicRegisterRole;
    fullName?: string;
  }) {
    const hash = await bcrypt.hash(input.password, 10);
    const user = await this.usersService.createUserWithProfile({
      phone: input.phone,
      email: input.email,
      passwordHash: hash,
      role: input.role,
      fullName: input.fullName,
    });
    const tokens = await this.issueTokens(user.id, user.role);
    const {
      password: _password,
      refreshTokenHash: _refreshTokenHash,
      ...safeUser
    } = user as any;
    return { user: safeUser, ...tokens };
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

    if (user.role === 'DRIVER_INTERCITY') {
      user = (await this.usersService.upgradeLegacyIntercityDriver(user.id)) as any;
      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }
    }

    if (user.role === 'COURIER') {
      user = (await this.usersService.upgradeLegacyCourier(user.id)) as any;
      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }
    }

    if (user.role === 'DRIVER') {
      user = (await this.usersService.ensureUnifiedDriverProfile(user.id)) as any;
      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }
    }

    const tokens = await this.issueTokens(user.id, user.role);
    const {
      password: _password,
      refreshTokenHash: _refreshTokenHash,
      ...safeUser
    } = user as any;
    return { user: safeUser, ...tokens };
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

      if (refreshedUser.role === 'DRIVER_INTERCITY') {
        const upgradedUser = await this.usersService.upgradeLegacyIntercityDriver(refreshedUser.id);
        return this.issueTokens(payload.sub, (upgradedUser?.role ?? 'DRIVER') as UserRole);
      }

      if (refreshedUser.role === 'COURIER') {
        const upgradedUser = await this.usersService.upgradeLegacyCourier(refreshedUser.id);
        return this.issueTokens(payload.sub, (upgradedUser?.role ?? 'DRIVER') as UserRole);
      }

      if (refreshedUser.role === 'DRIVER') {
        await this.usersService.ensureUnifiedDriverProfile(refreshedUser.id);
      }

      return this.issueTokens(payload.sub, refreshedUser.role);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async revokeRefreshToken(userId: string) {
    await this.usersService.updateRefreshTokenHash(userId, null);
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
}

