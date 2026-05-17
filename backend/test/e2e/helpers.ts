import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { RideStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RedisService } from '../../src/redis/redis.service';
import { UsersService } from '../../src/users/users.service';
import type { JwtPayload } from '../../src/auth/auth.service';

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    phone: string;
    role: string;
  };
};

export type E2eAppContext = {
  app: INestApplication;
  http: ReturnType<typeof request>;
  prisma: PrismaService;
  redis: RedisService;
  baseUrl: string;
};

export async function createE2eApp(): Promise<E2eAppContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  const redisService = app.get(RedisService);
  const redisAdapter = await redisService.createSocketAdapter(app);
  if (redisAdapter) {
    app.useWebSocketAdapter(redisAdapter);
  }

  app.enableCors();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(0, '127.0.0.1');

  const address = app.getHttpServer().address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to resolve E2E app port');
  }
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    app,
    http: request(baseUrl),
    prisma: app.get(PrismaService),
    redis: redisService,
    baseUrl,
  };
}

export async function resetDatabase(prisma: PrismaService) {
  await prisma.$transaction([
    prisma.chatMessage.deleteMany(),
    prisma.favoriteAddress.deleteMany(),
    prisma.rideStatusHistory.deleteMany(),
    prisma.rideStop.deleteMany(),
    prisma.ride.deleteMany(),
    prisma.courierOrderStatusHistory.deleteMany(),
    prisma.courierOrder.deleteMany(),
    prisma.foodOrderStatusHistory.deleteMany(),
    prisma.foodOrderItem.deleteMany(),
    prisma.foodOrder.deleteMany(),
    prisma.menuItem.deleteMany(),
    prisma.menuCategory.deleteMany(),
    prisma.intercityTripInvite.deleteMany(),
    prisma.intercityTripStatusHistory.deleteMany(),
    prisma.intercityBooking.deleteMany(),
    prisma.intercityTrip.deleteMany(),
    prisma.intercityOrderStatusHistory.deleteMany(),
    prisma.intercityOrder.deleteMany(),
    prisma.driverDocument.deleteMany(),
    prisma.car.deleteMany(),
    prisma.tariff.deleteMany(),
    prisma.passengerProfile.deleteMany(),
    prisma.driverProfile.deleteMany(),
    prisma.merchant.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export async function resetRedis(redis: RedisService) {
  const client = await (redis as any).getClient?.();
  if (client) {
    await client.flushdb();
  }
}

export async function registerUser(
  http: ReturnType<typeof request>,
  params: {
    phone: string;
    password?: string;
    role: 'PASSENGER' | 'DRIVER' | 'MERCHANT';
    fullName: string;
  },
) {
  const password = params.password ?? 'password123';
  const response = await http.post('/api/auth/register').send({
    phone: params.phone,
    password,
    role: params.role,
    fullName: params.fullName,
  });
  expect(response.status).toBe(201);
  return {
    ...(response.body as AuthTokens),
    password,
  };
}

export async function loginUser(
  http: ReturnType<typeof request>,
  phone: string,
  password: string,
) {
  const response = await http.post('/api/auth/login').send({ phone, password });
  expect(response.status).toBe(201);
  return response.body as AuthTokens;
}

/**
 * Mass E2E / load harness: create a verified user in DB and mint an access JWT with the same
 * secret/options as production auth (OTP is bypassed because phoneVerifiedAt is set).
 */
export async function seedVerifiedUserWithAccessToken(
  app: INestApplication,
  params: {
    phone: string;
    role: UserRole;
    fullName: string;
    password?: string;
  },
) {
  const usersService = app.get(UsersService);
  const jwtService = app.get(JwtService);
  const password = params.password ?? 'password123';
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await usersService.createUserWithProfile({
    phone: params.phone,
    passwordHash,
    role: params.role,
    fullName: params.fullName,
    phoneVerifiedAt: new Date(),
  });
  const payload: JwtPayload = {
    sub: user.id,
    role: user.role,
    tokenType: 'access',
  };
  const accessToken = jwtService.sign(payload);
  return { user, accessToken, password };
}

export async function makeReadyTaxiDriver(
  prisma: PrismaService,
  userId: string,
  fullName = 'Ready Taxi Driver',
) {
  const driver = await prisma.driverProfile.findUnique({
    where: { userId },
  });
  if (!driver) {
    throw new Error(`Driver profile not found for user ${userId}`);
  }

  await prisma.driverProfile.update({
    where: { userId },
    data: {
      fullName,
      status: 'APPROVED',
      balance: 1500,
      supportsTaxi: true,
      supportsCourier: true,
      supportsIntercity: false,
      driverMode: 'TAXI',
      rating: 5,
    },
  });

  await prisma.car.create({
    data: {
      driverId: driver.id,
      make: 'Toyota',
      model: 'Camry',
      color: 'Black',
      plateNumber: `E2E-${userId.slice(-4).toUpperCase()}`,
    },
  });

  await prisma.driverDocument.createMany({
    data: [
      {
        driverId: driver.id,
        type: 'DRIVER_LICENSE',
        url: '/e2e/license.png',
        approved: true,
      },
      {
        driverId: driver.id,
        type: 'CAR_REGISTRATION',
        url: '/e2e/registration.png',
        approved: true,
      },
    ],
  });

  return prisma.driverProfile.findUnique({
    where: { userId },
    include: { user: true, car: true, documents: true },
  });
}

/** Same documents/car as taxi, plus intercity flag (JWT role stays DRIVER for intercity APIs). */
export async function makeReadyIntercityDriver(
  prisma: PrismaService,
  userId: string,
  fullName = 'Ready Intercity Driver',
) {
  const base = await makeReadyTaxiDriver(prisma, userId, fullName);
  await prisma.driverProfile.update({
    where: { userId },
    data: { supportsIntercity: true },
  });
  return prisma.driverProfile.findUnique({
    where: { userId },
    include: { user: true, car: true, documents: true },
  });
}

/** Lower `priority` (0 first) is offered taxi rides earlier when distances tie. */
export async function setDriverDispatchPriority(
  prisma: PrismaService,
  userId: string,
  priority: number,
) {
  const day = new Date(Date.UTC(2020, 0, 2 + priority));
  await prisma.driverProfile.update({
    where: { userId },
    data: { lastRideFinishedAt: day },
  });
}

export function connectSocket(baseUrl: string, accessToken: string) {
  const socket = io(`${baseUrl}/app`, {
    path: '/socket.io',
    auth: { token: accessToken },
    transports: ['websocket', 'polling'],
    reconnection: false,
  });

  return new Promise<Socket>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Socket connection timeout'));
    }, 8000);

    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

export function waitForSocketEvent<T>(
  socket: Socket,
  event: string,
  predicate?: (payload: T) => boolean,
  timeoutMs = 8000,
) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for socket event "${event}"`));
    }, timeoutMs);

    const handler = (payload: T) => {
      if (predicate && !predicate(payload)) {
        return;
      }
      clearTimeout(timeout);
      socket.off(event, handler);
      resolve(payload);
    };

    socket.on(event, handler);
  });
}

export async function waitForCondition(
  assertion: () => Promise<boolean>,
  timeoutMs = 8000,
  intervalMs = 150,
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await assertion()) {
      return;
    }
    await sleep(intervalMs);
  }
  throw new Error('Timed out waiting for condition');
}

export async function createTaxiRide(
  http: ReturnType<typeof request>,
  accessToken: string,
) {
  const response = await http
    .post('/api/rides')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      fromAddress: 'Almaty Airport',
      toAddress: 'Medeu',
      fromLat: 43.3521,
      fromLng: 77.0405,
      toLat: 43.1631,
      toLng: 77.0592,
      estimatedPrice: 3500,
      comment: 'E2E ride',
    });

  expect(response.status).toBe(201);
  return response.body;
}

export function authHeader(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

export function expectRideStatus(ride: any, status: RideStatus) {
  expect(ride).toBeTruthy();
  expect(ride.status).toBe(status);
}

export async function closeSocket(socket: Socket | null) {
  if (!socket) {
    return;
  }
  socket.removeAllListeners();
  socket.disconnect();
  await sleep(50);
}

export function buildPhone(seed: number) {
  return `+7701000${String(seed).padStart(4, '0')}`;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
