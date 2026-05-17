import { FoodOrderStatus, Prisma } from '@prisma/client';
import {
  authHeader,
  buildPhone,
  createE2eApp,
  E2eAppContext,
  resetDatabase,
  resetRedis,
  seedVerifiedUserWithAccessToken,
} from './e2e/helpers';

describe('Food order flow E2E', () => {
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

  it('creates an order and walks merchant status transitions', async () => {
    const base = Date.now() % 6000;

    const merchantUser = await seedVerifiedUserWithAccessToken(ctx.app, {
      phone: buildPhone(base),
      role: 'MERCHANT',
      fullName: 'E2E Cafe',
    });

    const merchant = await ctx.prisma.merchant.findUniqueOrThrow({
      where: { userId: merchantUser.user.id },
    });

    await ctx.prisma.merchant.update({
      where: { id: merchant.id },
      data: { name: 'E2E Test Kitchen', isOpen: true },
    });

    const category = await ctx.prisma.menuCategory.create({
      data: {
        merchantId: merchant.id,
        name: 'Mains',
        sortOrder: 0,
      },
    });

    const item = await ctx.prisma.menuItem.create({
      data: {
        categoryId: category.id,
        name: 'Plov',
        price: new Prisma.Decimal(2500),
        isAvailable: true,
        sortOrder: 0,
      },
    });

    const passenger = await seedVerifiedUserWithAccessToken(ctx.app, {
      phone: buildPhone(base + 1),
      role: 'PASSENGER',
      fullName: 'Hungry Passenger',
    });

    const createRes = await ctx.http
      .post('/api/food-orders')
      .set(authHeader(passenger.accessToken))
      .send({
        merchantId: merchant.id,
        deliveryAddress: 'Abay 150',
        items: [{ menuItemId: item.id, qty: 2 }],
        paymentMethod: 'CARD',
      });

    expect(createRes.status).toBe(201);
    const orderId = createRes.body.id as string;
    expect(createRes.body.status).toBe(FoodOrderStatus.PLACED);

    const chain: FoodOrderStatus[] = [
      FoodOrderStatus.ACCEPTED,
      FoodOrderStatus.PREPARING,
      FoodOrderStatus.READY_FOR_PICKUP,
      FoodOrderStatus.ON_DELIVERY,
      FoodOrderStatus.DELIVERED,
    ];

    for (const status of chain) {
      const res = await ctx.http
        .post(`/api/food-orders/${orderId}/status`)
        .set(authHeader(merchantUser.accessToken))
        .send({ status });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe(status);
    }

    const getRes = await ctx.http
      .get(`/api/food-orders/${orderId}`)
      .set(authHeader(passenger.accessToken));
    expect(getRes.status).toBe(200);
    expect(getRes.body.status).toBe(FoodOrderStatus.DELIVERED);
  });
});
