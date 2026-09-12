import { UserRole } from '@prisma/client';
import {
  authHeader,
  buildPhone,
  createE2eApp,
  E2eAppContext,
  resetDatabase,
  resetRedis,
  seedVerifiedUserWithAccessToken,
} from './e2e/helpers';

describe('Account roles E2E', () => {
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

  it('lets a passenger become a driver without giving up the passenger profile', async () => {
    const passenger = await seedVerifiedUserWithAccessToken(ctx.app, {
      phone: buildPhone(6101),
      role: UserRole.PASSENGER,
      fullName: 'Асхат Пассажиров',
    });

    const before = await ctx.http
      .get('/api/auth/roles')
      .set(authHeader(passenger.accessToken))
      .expect(200);
    expect(before.body.activeRole).toBe(UserRole.PASSENGER);
    expect(before.body.availableRoles).toEqual([UserRole.PASSENGER]);

    const becameDriver = await ctx.http
      .post('/api/auth/roles/driver')
      .set(authHeader(passenger.accessToken))
      .send({})
      .expect(201);

    expect(becameDriver.body.role).toBe(UserRole.DRIVER);
    expect(becameDriver.body.accessToken).toEqual(expect.any(String));
    expect(becameDriver.body.refreshToken).toEqual(expect.any(String));
    expect(becameDriver.body.availableRoles).toEqual(
      expect.arrayContaining([UserRole.PASSENGER, UserRole.DRIVER]),
    );

    // The passenger profile has to survive: the whole point is that one person
    // both drives and orders rides from the same account.
    const user = await ctx.prisma.user.findUnique({
      where: { id: passenger.user.id },
      include: { passenger: true, driver: true },
    });
    expect(user?.role).toBe(UserRole.DRIVER);
    expect(user?.passenger).toBeTruthy();
    expect(user?.driver).toBeTruthy();
    // Reuses the name they already gave, and starts with the usual balance.
    expect(user?.driver?.fullName).toBe('Асхат Пассажиров');
    expect(Number(user?.driver?.balance ?? 0)).toBeGreaterThan(0);

    // The old token still carries PASSENGER; only the fresh one is a driver.
    const withNewToken = await ctx.http
      .get('/api/auth/roles')
      .set(authHeader(becameDriver.body.accessToken))
      .expect(200);
    expect(withNewToken.body.activeRole).toBe(UserRole.DRIVER);
  });

  it('switches back to the passenger role and returns usable tokens', async () => {
    const passenger = await seedVerifiedUserWithAccessToken(ctx.app, {
      phone: buildPhone(6102),
      role: UserRole.PASSENGER,
      fullName: 'Айгүл Тест',
    });

    const asDriver = await ctx.http
      .post('/api/auth/roles/driver')
      .set(authHeader(passenger.accessToken))
      .send({})
      .expect(201);

    const backToPassenger = await ctx.http
      .post('/api/auth/roles/switch')
      .set(authHeader(asDriver.body.accessToken))
      .send({ role: UserRole.PASSENGER })
      .expect(201);

    expect(backToPassenger.body.role).toBe(UserRole.PASSENGER);

    const roles = await ctx.http
      .get('/api/auth/roles')
      .set(authHeader(backToPassenger.body.accessToken))
      .expect(200);
    expect(roles.body.activeRole).toBe(UserRole.PASSENGER);
    expect(roles.body.availableRoles).toEqual(
      expect.arrayContaining([UserRole.PASSENGER, UserRole.DRIVER]),
    );
  });

  it('refuses a role the account has no profile for', async () => {
    const passenger = await seedVerifiedUserWithAccessToken(ctx.app, {
      phone: buildPhone(6103),
      role: UserRole.PASSENGER,
      fullName: 'Без водительского профиля',
    });

    await ctx.http
      .post('/api/auth/roles/switch')
      .set(authHeader(passenger.accessToken))
      .send({ role: UserRole.DRIVER })
      .expect(400);

    const user = await ctx.prisma.user.findUnique({
      where: { id: passenger.user.id },
    });
    expect(user?.role).toBe(UserRole.PASSENGER);
  });

  it('requires a signed-in account', async () => {
    await ctx.http.get('/api/auth/roles').expect(401);
    await ctx.http.post('/api/auth/roles/driver').send({}).expect(401);
  });
});
