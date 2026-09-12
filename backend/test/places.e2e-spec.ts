import { PlaceKind, PlaceSource, UserRole } from '@prisma/client';
import {
  authHeader,
  buildPhone,
  createE2eApp,
  E2eAppContext,
  resetDatabase,
  resetRedis,
  seedVerifiedUserWithAccessToken,
} from './e2e/helpers';

// Real Usharal coordinates, so the distances in these tests are the ones the
// app will actually be dealing with.
const SHOP = { lat: 46.1725, lng: 80.9333 };
const STREET = { lat: 46.174, lng: 80.9333 };

describe('Places E2E', () => {
  let ctx: E2eAppContext;
  let accessToken: string;

  beforeAll(async () => {
    ctx = await createE2eApp();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await resetRedis(ctx.redis);

    const passenger = await seedVerifiedUserWithAccessToken(ctx.app, {
      phone: buildPhone(7201),
      role: UserRole.PASSENGER,
      fullName: 'Тест Пассажиров',
    });
    accessToken = passenger.accessToken;

    await ctx.prisma.place.createMany({
      data: [
        {
          name: 'Алатау',
          aliases: ['алатау', 'магазин Алатау'],
          kind: PlaceKind.POI,
          category: 'shop:supermarket',
          lat: SHOP.lat,
          lng: SHOP.lng,
          source: PlaceSource.OSM,
          externalId: 'node/1',
        },
        {
          name: 'улица Абылай Хана',
          kind: PlaceKind.STREET,
          category: 'residential',
          lat: STREET.lat,
          lng: STREET.lng,
          source: PlaceSource.OSM,
          externalId: 'way/1',
        },
      ],
    });
  });

  afterAll(async () => {
    await ctx?.app?.close();
  });

  it('names the shop when the pin lands on it', async () => {
    const response = await ctx.http
      .get(`/api/places/nearest?lat=${SHOP.lat}&lng=${SHOP.lng}`)
      .set(authHeader(accessToken))
      .expect(200);

    expect(response.body.label).toBe('Алатау');
    expect(response.body.place.name).toBe('Алатау');
    expect(response.body.place.distanceM).toBeLessThan(40);
  });

  it('says "возле" once the pin is a little way off', async () => {
    // ~80 m north of the shop: close enough to name, too far to claim it is at.
    const response = await ctx.http
      .get(`/api/places/nearest?lat=${SHOP.lat + 0.0007}&lng=${SHOP.lng}`)
      .set(authHeader(accessToken))
      .expect(200);

    expect(response.body.label).toBe('возле Алатау');
  });

  it('falls back to the street when no place is close', async () => {
    // ~220 m from the shop, right on the street.
    const response = await ctx.http
      .get(`/api/places/nearest?lat=${STREET.lat}&lng=${STREET.lng}`)
      .set(authHeader(accessToken))
      .expect(200);

    expect(response.body.label).toBe('улица Абылай Хана');
    expect(response.body.street.name).toBe('улица Абылай Хана');
  });

  it('answers with nothing rather than a guess when the pin is out in the steppe', async () => {
    const response = await ctx.http
      .get(`/api/places/nearest?lat=${SHOP.lat + 0.5}&lng=${SHOP.lng + 0.5}`)
      .set(authHeader(accessToken))
      .expect(200);

    expect(response.body.label).toBeNull();
    expect(response.body.place).toBeNull();
    expect(response.body.street).toBeNull();
  });

  it('finds a place by an alias people actually use', async () => {
    const response = await ctx.http
      .get('/api/places/search?q=алатау')
      .set(authHeader(accessToken))
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('Алатау');
  });

  it('rejects coordinates that are not coordinates', async () => {
    await ctx.http
      .get('/api/places/nearest?lat=999&lng=80.9')
      .set(authHeader(accessToken))
      .expect(400);
  });

  it('requires a signed-in account', async () => {
    await ctx.http.get(`/api/places/nearest?lat=${SHOP.lat}&lng=${SHOP.lng}`).expect(401);
  });
});
