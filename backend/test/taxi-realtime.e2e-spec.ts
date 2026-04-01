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
  loginUser,
  makeReadyTaxiDriver,
  registerUser,
  resetDatabase,
  resetRedis,
  sleep,
  waitForCondition,
  waitForSocketEvent,
} from './e2e/helpers';

describe('Taxi realtime E2E', () => {
  let ctx: E2eAppContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await resetRedis(ctx.redis);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('runs passenger -> offer -> accept -> synced recovery endpoints', async () => {
    const passengerSeed = Date.now() % 10000;
    const driverSeed = passengerSeed + 1;

    const passengerRegistration = await registerUser(ctx.http, {
      phone: buildPhone(passengerSeed),
      role: 'PASSENGER',
      fullName: 'E2E Passenger',
    });
    const driverRegistration = await registerUser(ctx.http, {
      phone: buildPhone(driverSeed),
      role: 'DRIVER',
      fullName: 'E2E Driver',
    });

    await makeReadyTaxiDriver(ctx.prisma, driverRegistration.user.id, 'E2E Driver');

    const passengerLogin = await loginUser(
      ctx.http,
      passengerRegistration.user.phone,
      passengerRegistration.password,
    );
    const driverLogin = await loginUser(
      ctx.http,
      driverRegistration.user.phone,
      driverRegistration.password,
    );

    const passengerSocket = await connectSocket(ctx.baseUrl, passengerLogin.accessToken);
    const driverSocket = await connectSocket(ctx.baseUrl, driverLogin.accessToken);

    try {
      const onlineResponse = await ctx.http
        .post('/api/drivers/status')
        .set(authHeader(driverLogin.accessToken))
        .send({ isOnline: true });
      expect(onlineResponse.status).toBe(201);

      const locationResponse = await ctx.http
        .patch('/api/drivers/location')
        .set(authHeader(driverLogin.accessToken))
        .send({ lat: 43.3525, lng: 77.043 });
      expect(locationResponse.status).toBe(200);

      const offerPromise = waitForSocketEvent<any>(
        driverSocket,
        'ride:offer',
        (payload) => payload.status === RideStatus.SEARCHING_DRIVER,
      );

      const ride = await createTaxiRide(ctx.http, passengerLogin.accessToken);
      const offeredRide = await offerPromise;
      expect(offeredRide.id).toBe(ride.id);

      const passengerUpdatedPromise = waitForSocketEvent<any>(
        passengerSocket,
        'ride:updated',
        (payload) => payload.id === ride.id && payload.status === RideStatus.ON_THE_WAY,
      );
      const driverUpdatedPromise = waitForSocketEvent<any>(
        driverSocket,
        'ride:updated',
        (payload) => payload.id === ride.id && payload.status === RideStatus.ON_THE_WAY,
      );

      const acceptResponse = await ctx.http
        .post(`/api/rides/${ride.id}/accept`)
        .set(authHeader(driverLogin.accessToken))
        .send({});
      expect(acceptResponse.status).toBe(201);

      const [passengerUpdated, driverUpdated] = await Promise.all([
        passengerUpdatedPromise,
        driverUpdatedPromise,
      ]);
      expectRideStatus(passengerUpdated, RideStatus.ON_THE_WAY);
      expectRideStatus(driverUpdated, RideStatus.ON_THE_WAY);

      const [passengerCurrentRideResponse, driverCurrentRideResponse] = await Promise.all([
        ctx.http
          .get('/api/rides/current')
          .set(authHeader(passengerLogin.accessToken)),
        ctx.http
          .get('/api/drivers/current-ride')
          .set(authHeader(driverLogin.accessToken)),
      ]);

      expect(passengerCurrentRideResponse.status).toBe(200);
      expect(driverCurrentRideResponse.status).toBe(200);
      expectRideStatus(passengerCurrentRideResponse.body, RideStatus.ON_THE_WAY);
      expectRideStatus(driverCurrentRideResponse.body, RideStatus.ON_THE_WAY);
      expect(passengerCurrentRideResponse.body.id).toBe(driverCurrentRideResponse.body.id);

      const redisPassengerAssignment = await ctx.redis.getActiveAssignment(
        'ride',
        passengerLogin.user.id,
      );
      const redisDriverAssignment = await ctx.redis.getActiveAssignment(
        'ride',
        driverLogin.user.id,
      );
      expect(redisPassengerAssignment?.entityId).toBe(ride.id);
      expect(redisDriverAssignment?.entityId).toBe(ride.id);
      expect(redisPassengerAssignment?.status).toBe(RideStatus.ON_THE_WAY);
    } finally {
      await closeSocket(passengerSocket);
      await closeSocket(driverSocket);
    }
  });

  it('broadcasts status transitions and keeps Redis recovery in sync', async () => {
    const passengerRegistration = await registerUser(ctx.http, {
      phone: buildPhone((Date.now() + 2) % 10000),
      role: 'PASSENGER',
      fullName: 'Status Passenger',
    });
    const driverRegistration = await registerUser(ctx.http, {
      phone: buildPhone((Date.now() + 3) % 10000),
      role: 'DRIVER',
      fullName: 'Status Driver',
    });

    await makeReadyTaxiDriver(ctx.prisma, driverRegistration.user.id, 'Status Driver');

    const passengerLogin = await loginUser(
      ctx.http,
      passengerRegistration.user.phone,
      passengerRegistration.password,
    );
    const driverLogin = await loginUser(
      ctx.http,
      driverRegistration.user.phone,
      driverRegistration.password,
    );

    const passengerSocket = await connectSocket(ctx.baseUrl, passengerLogin.accessToken);
    const driverSocket = await connectSocket(ctx.baseUrl, driverLogin.accessToken);

    try {
      await ctx.http
        .post('/api/drivers/status')
        .set(authHeader(driverLogin.accessToken))
        .send({ isOnline: true });
      await ctx.http
        .patch('/api/drivers/location')
        .set(authHeader(driverLogin.accessToken))
        .send({ lat: 43.3525, lng: 77.043 });

      const offerPromise = waitForSocketEvent<any>(driverSocket, 'ride:offer');
      const ride = await createTaxiRide(ctx.http, passengerLogin.accessToken);
      await offerPromise;

      await ctx.http
        .post(`/api/rides/${ride.id}/accept`)
        .set(authHeader(driverLogin.accessToken))
        .send({});

      const passengerArrivedPromise = waitForSocketEvent<any>(
        passengerSocket,
        'ride:updated',
        (payload) => payload.id === ride.id && payload.status === RideStatus.DRIVER_ARRIVED,
      );
      const driverArrivedPromise = waitForSocketEvent<any>(
        driverSocket,
        'ride:updated',
        (payload) => payload.id === ride.id && payload.status === RideStatus.DRIVER_ARRIVED,
      );

      const arrivedResponse = await ctx.http
        .post(`/api/rides/${ride.id}/status`)
        .set(authHeader(driverLogin.accessToken))
        .send({ status: RideStatus.DRIVER_ARRIVED });
      expect(arrivedResponse.status).toBe(201);
      await Promise.all([passengerArrivedPromise, driverArrivedPromise]);

      const passengerProgressPromise = waitForSocketEvent<any>(
        passengerSocket,
        'ride:updated',
        (payload) => payload.id === ride.id && payload.status === RideStatus.IN_PROGRESS,
      );
      const driverProgressPromise = waitForSocketEvent<any>(
        driverSocket,
        'ride:updated',
        (payload) => payload.id === ride.id && payload.status === RideStatus.IN_PROGRESS,
      );

      const inProgressResponse = await ctx.http
        .post(`/api/rides/${ride.id}/status`)
        .set(authHeader(driverLogin.accessToken))
        .send({ status: RideStatus.IN_PROGRESS });
      expect(inProgressResponse.status).toBe(201);
      await Promise.all([passengerProgressPromise, driverProgressPromise]);

      const redisPassengerAssignment = await ctx.redis.getActiveAssignment(
        'ride',
        passengerLogin.user.id,
      );
      const redisDriverAssignment = await ctx.redis.getActiveAssignment(
        'ride',
        driverLogin.user.id,
      );
      expect(redisPassengerAssignment?.status).toBe(RideStatus.IN_PROGRESS);
      expect(redisDriverAssignment?.status).toBe(RideStatus.IN_PROGRESS);

      const [passengerCurrentRideResponse, driverCurrentRideResponse] = await Promise.all([
        ctx.http
          .get('/api/rides/current')
          .set(authHeader(passengerLogin.accessToken)),
        ctx.http
          .get('/api/drivers/current-ride')
          .set(authHeader(driverLogin.accessToken)),
      ]);

      expectRideStatus(passengerCurrentRideResponse.body, RideStatus.IN_PROGRESS);
      expectRideStatus(driverCurrentRideResponse.body, RideStatus.IN_PROGRESS);
    } finally {
      await closeSocket(passengerSocket);
      await closeSocket(driverSocket);
    }
  });

  it('cleans active assignments on cancellation and restores ride after socket reconnect', async () => {
    const passengerRegistration = await registerUser(ctx.http, {
      phone: buildPhone((Date.now() + 4) % 10000),
      role: 'PASSENGER',
      fullName: 'Reconnect Passenger',
    });
    const driverRegistration = await registerUser(ctx.http, {
      phone: buildPhone((Date.now() + 5) % 10000),
      role: 'DRIVER',
      fullName: 'Reconnect Driver',
    });

    await makeReadyTaxiDriver(ctx.prisma, driverRegistration.user.id, 'Reconnect Driver');

    const passengerLogin = await loginUser(
      ctx.http,
      passengerRegistration.user.phone,
      passengerRegistration.password,
    );
    const driverLogin = await loginUser(
      ctx.http,
      driverRegistration.user.phone,
      driverRegistration.password,
    );

    const passengerSocket = await connectSocket(ctx.baseUrl, passengerLogin.accessToken);
    let driverSocket: Socket | null = await connectSocket(ctx.baseUrl, driverLogin.accessToken);

    try {
      await ctx.http
        .post('/api/drivers/status')
        .set(authHeader(driverLogin.accessToken))
        .send({ isOnline: true });
      await ctx.http
        .patch('/api/drivers/location')
        .set(authHeader(driverLogin.accessToken))
        .send({ lat: 43.3525, lng: 77.043 });

      const offerPromise = waitForSocketEvent<any>(driverSocket, 'ride:offer');
      const ride = await createTaxiRide(ctx.http, passengerLogin.accessToken);
      await offerPromise;
      await ctx.http
        .post(`/api/rides/${ride.id}/accept`)
        .set(authHeader(driverLogin.accessToken))
        .send({});

      driverSocket.disconnect();
      await waitForCondition(async () => {
        const driverProfile = await ctx.prisma.driverProfile.findUnique({
          where: { userId: driverLogin.user.id },
          select: { isOnline: true },
        });
        return driverProfile?.isOnline === false;
      });

      driverSocket = await connectSocket(ctx.baseUrl, driverLogin.accessToken);

      const currentRideResponse = await ctx.http
        .get('/api/drivers/current-ride')
        .set(authHeader(driverLogin.accessToken));
      expect(currentRideResponse.status).toBe(200);
      expectRideStatus(currentRideResponse.body, RideStatus.ON_THE_WAY);

      const driverCanceledPromise = waitForSocketEvent<any>(
        driverSocket,
        'ride:updated',
        (payload) => payload.id === ride.id && payload.status === RideStatus.CANCELED,
      );
      const passengerCanceledPromise = waitForSocketEvent<any>(
        passengerSocket,
        'ride:updated',
        (payload) => payload.id === ride.id && payload.status === RideStatus.CANCELED,
      );

      const cancelResponse = await ctx.http
        .post(`/api/rides/${ride.id}/cancel`)
        .set(authHeader(passengerLogin.accessToken))
        .send({});
      expect(cancelResponse.status).toBe(201);

      await Promise.all([driverCanceledPromise, passengerCanceledPromise]);
      await sleep(100);

      const [passengerCurrentRideResponse, driverCurrentRideResponse] = await Promise.all([
        ctx.http
          .get('/api/rides/current')
          .set(authHeader(passengerLogin.accessToken)),
        ctx.http
          .get('/api/drivers/current-ride')
          .set(authHeader(driverLogin.accessToken)),
      ]);

      expect(passengerCurrentRideResponse.status).toBe(200);
      expect(driverCurrentRideResponse.status).toBe(200);
      expect(passengerCurrentRideResponse.body ?? {}).toEqual({});
      expect(driverCurrentRideResponse.body ?? {}).toEqual({});

      const redisPassengerAssignment = await ctx.redis.getActiveAssignment(
        'ride',
        passengerLogin.user.id,
      );
      const redisDriverAssignment = await ctx.redis.getActiveAssignment(
        'ride',
        driverLogin.user.id,
      );
      expect(redisPassengerAssignment).toBeNull();
      expect(redisDriverAssignment).toBeNull();
    } finally {
      await closeSocket(passengerSocket);
      await closeSocket(driverSocket);
    }
  });
});
