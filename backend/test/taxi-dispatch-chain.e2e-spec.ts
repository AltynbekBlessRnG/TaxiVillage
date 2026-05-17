import { RideStatus } from '@prisma/client';
import { Socket } from 'socket.io-client';
import {
  authHeader,
  buildPhone,
  closeSocket,
  connectSocket,
  createE2eApp,
  createTaxiRide,
  E2eAppContext,
  expectRideStatus,
  makeReadyTaxiDriver,
  resetDatabase,
  resetRedis,
  seedVerifiedUserWithAccessToken,
  setDriverDispatchPriority,
  waitForSocketEvent,
} from './e2e/helpers';

describe('Taxi dispatch chain E2E', () => {
  let ctx: E2eAppContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await resetRedis(ctx.redis);
  });

  afterAll(async () => {
    await ctx?.app?.close();
  });

  it('re-offers to the next driver after reject', async () => {
    const base = Date.now() % 9000;
    const passenger = await seedVerifiedUserWithAccessToken(ctx.app, {
      phone: buildPhone(base),
      role: 'PASSENGER',
      fullName: 'Chain Passenger',
    });

    const drivers: { token: string; socket: Socket; userId: string }[] = [];
    const sockets: Socket[] = [];

    try {
      for (let i = 0; i < 4; i += 1) {
        const d = await seedVerifiedUserWithAccessToken(ctx.app, {
          phone: buildPhone(base + 1 + i),
          role: 'DRIVER',
          fullName: `Chain Driver ${i}`,
        });
        await makeReadyTaxiDriver(ctx.prisma, d.user.id, `Chain Driver ${i}`);
        await setDriverDispatchPriority(ctx.prisma, d.user.id, i);
        const socket = await connectSocket(ctx.baseUrl, d.accessToken);
        sockets.push(socket);
        drivers.push({ token: d.accessToken, socket, userId: d.user.id });

        const onlineRes = await ctx.http
          .post('/api/drivers/status')
          .set(authHeader(d.accessToken))
          .send({ isOnline: true });
        expect(onlineRes.status).toBe(201);

        const locRes = await ctx.http
          .patch('/api/drivers/location')
          .set(authHeader(d.accessToken))
          .send({ lat: 43.3525 + i * 0.0001, lng: 77.043 + i * 0.0001 });
        expect(locRes.status).toBe(200);
      }

      const firstOffer = waitForSocketEvent<any>(
        drivers[0].socket,
        'ride:offer',
        (p) => p.status === RideStatus.SEARCHING_DRIVER,
      );
      const secondOffer = waitForSocketEvent<any>(
        drivers[1].socket,
        'ride:offer',
        (p) => p.status === RideStatus.SEARCHING_DRIVER,
      );

      const ride = await createTaxiRide(ctx.http, passenger.accessToken);
      const offer1 = await firstOffer;
      expect(offer1.id).toBe(ride.id);

      const rejectRes = await ctx.http
        .post(`/api/rides/${ride.id}/reject`)
        .set(authHeader(drivers[0].token))
        .send({});
      expect(rejectRes.status).toBe(201);

      const offer2 = await secondOffer;
      expect(offer2.id).toBe(ride.id);

      const passengerSocket = await connectSocket(ctx.baseUrl, passenger.accessToken);
      sockets.push(passengerSocket);

      const passengerOnTheWay = waitForSocketEvent<any>(
        passengerSocket,
        'ride:updated',
        (p) => p.id === ride.id && p.status === RideStatus.ON_THE_WAY,
      );

      const acceptRes = await ctx.http
        .post(`/api/rides/${ride.id}/accept`)
        .set(authHeader(drivers[1].token))
        .send({});
      expect(acceptRes.status).toBe(201);

      const updated = await passengerOnTheWay;
      expectRideStatus(updated, RideStatus.ON_THE_WAY);
    } finally {
      for (const s of sockets) {
        await closeSocket(s);
      }
    }
  });
});
