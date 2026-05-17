import { IntercityBookingType, IntercityTripStatus } from '@prisma/client';
import {
  authHeader,
  buildPhone,
  createE2eApp,
  E2eAppContext,
  makeReadyIntercityDriver,
  resetDatabase,
  resetRedis,
  seedVerifiedUserWithAccessToken,
} from './e2e/helpers';

describe('Intercity flow E2E', () => {
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

  it('creates a trip and confirms a seat booking', async () => {
    const base = Date.now() % 8000;
    const driver = await seedVerifiedUserWithAccessToken(ctx.app, {
      phone: buildPhone(base),
      role: 'DRIVER',
      fullName: 'Intercity Driver',
    });
    await makeReadyIntercityDriver(ctx.prisma, driver.user.id);

    const passenger = await seedVerifiedUserWithAccessToken(ctx.app, {
      phone: buildPhone(base + 1),
      role: 'PASSENGER',
      fullName: 'Intercity Passenger',
    });

    const departureAt = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString();

    const createRes = await ctx.http
      .post('/api/intercity-trips')
      .set(authHeader(driver.accessToken))
      .send({
        fromCity: 'Almaty',
        toCity: 'Astana',
        departureAt,
        pricePerSeat: 5000,
        seatCapacity: 3,
        comment: 'E2E intercity',
      });
    expect(createRes.status).toBe(201);
    const trip = createRes.body;
    expect(trip.status).toBe(IntercityTripStatus.PLANNED);

    const bookRes = await ctx.http
      .post(`/api/intercity-trips/${trip.id}/book`)
      .set(authHeader(passenger.accessToken))
      .send({
        bookingType: IntercityBookingType.SEAT,
        seatsBooked: 1,
      });
    expect(bookRes.status).toBe(201);
    expect(bookRes.body.seatsBooked).toBe(1);
    expect(bookRes.body.tripId).toBe(trip.id);
  });

  it('allows only one passenger to take the last seat under concurrency', async () => {
    const base = Date.now() % 7000;
    const driver = await seedVerifiedUserWithAccessToken(ctx.app, {
      phone: buildPhone(base + 100),
      role: 'DRIVER',
      fullName: 'Intercity Driver Race',
    });
    await makeReadyIntercityDriver(ctx.prisma, driver.user.id);

    const p1 = await seedVerifiedUserWithAccessToken(ctx.app, {
      phone: buildPhone(base + 101),
      role: 'PASSENGER',
      fullName: 'Race P1',
    });
    const p2 = await seedVerifiedUserWithAccessToken(ctx.app, {
      phone: buildPhone(base + 102),
      role: 'PASSENGER',
      fullName: 'Race P2',
    });

    const departureAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const createRes = await ctx.http
      .post('/api/intercity-trips')
      .set(authHeader(driver.accessToken))
      .send({
        fromCity: 'Shymkent',
        toCity: 'Karaganda',
        departureAt,
        pricePerSeat: 4000,
        seatCapacity: 1,
      });
    expect(createRes.status).toBe(201);
    const tripId = createRes.body.id as string;

    const results = await Promise.all([
      ctx.http
        .post(`/api/intercity-trips/${tripId}/book`)
        .set(authHeader(p1.accessToken))
        .send({ bookingType: IntercityBookingType.SEAT, seatsBooked: 1 }),
      ctx.http
        .post(`/api/intercity-trips/${tripId}/book`)
        .set(authHeader(p2.accessToken))
        .send({ bookingType: IntercityBookingType.SEAT, seatsBooked: 1 }),
    ]);

    const ok = results.filter((r) => r.status === 201);
    const fail = results.filter((r) => r.status !== 201);
    expect(ok.length).toBe(1);
    expect(fail.length).toBe(1);
    expect([400, 409, 404]).toContain(fail[0].status);
  });
});
