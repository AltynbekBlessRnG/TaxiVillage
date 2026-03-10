import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  role: UserRole;
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
    role: UserRole;
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
    const tokens = this.issueTokens(user.id, user.role);
    return { user, ...tokens };
  }

  async login(phone: string, password: string) {
    const user = await this.usersService.findByPhone(phone);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = this.issueTokens(user.id, user.role);
    return { user, ...tokens };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken);
      return this.issueTokens(payload.sub, payload.role);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private issueTokens(userId: string, role: UserRole) {
    const payload: JwtPayload = { sub: userId, role };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });
    return { accessToken, refreshToken };
  }
}

