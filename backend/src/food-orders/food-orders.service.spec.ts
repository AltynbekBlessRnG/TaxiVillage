import {
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  FoodOrderStatus,
  MerchantVerificationStatus,
  PaymentMethod,
  Prisma,
  UserRole,
} from '@prisma/client';
import { FoodOrdersService } from './food-orders.service';

function makeService(overrides: Record<string, any> = {}) {
  const prisma: any = {
    passengerProfile: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    merchant: { findUnique: jest.fn(), findMany: jest.fn() },
    foodOrder: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    foodOrderStatusHistory: { create: jest.fn() },
    promoCode: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    promoCodeRedemption: { count: jest.fn(), create: jest.fn() },
    merchantSettlement: { create: jest.fn() },
    $transaction: jest.fn(),
    ...overrides,
  };
  const gateway = {
    emitOrderCreated: jest.fn(),
    emitOrderUpdated: jest.fn(),
    emitDeliveryAvailable: jest.fn(),
  };
  const notifications = { sendPush: jest.fn() };
  return {
    prisma,
    gateway,
    notifications,
    service: new FoodOrdersService(
      prisma,
      gateway as any,
      notifications as any,
    ),
  };
}

describe('FoodOrdersService beta flow', () => {
  it('rejects card payments for food orders', async () => {
    const { service } = makeService();

    await expect(
      service.createOrderForPassenger('passenger-user', {
        merchantId: 'merchant',
        deliveryAddress: 'Ушарал',
        items: [{ menuItemId: 'item', qty: 1 }],
        paymentMethod: PaymentMethod.CARD,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns an existing order for the same idempotency key', async () => {
    const existing = { id: 'existing-order' };
    const { service, prisma } = makeService();
    prisma.foodOrder.findUnique.mockResolvedValue(existing);

    const result = await service.createOrderForPassenger(
      'passenger-user',
      {
        merchantId: 'merchant',
        deliveryAddress: 'Ушарал',
        items: [{ menuItemId: 'item', qty: 1 }],
        paymentMethod: PaymentMethod.CASH,
      },
      'same-request',
    );

    expect(result).toBe(existing);
    expect(prisma.passengerProfile.findUnique).not.toHaveBeenCalled();
  });

  it('calculates subtotal and delivery fee on the server', async () => {
    const { service, prisma, gateway } = makeService();
    const passenger = {
      id: 'passenger',
      userId: 'passenger-user',
      user: { phone: '+77010000000' },
    };
    const merchant = {
      id: 'merchant',
      userId: 'merchant-user',
      name: 'Донер',
      contactPhone: '+77020000000',
      whatsAppPhone: null,
      deliveryFee: new Prisma.Decimal(700),
      deliveryRadiusKm: 8,
      minOrder: new Prisma.Decimal(0),
      verificationStatus: MerchantVerificationStatus.VERIFIED,
      isOpen: true,
      openingHours: null,
      lat: null,
      lng: null,
      user: { phone: '+77020000000', pushToken: null },
      menuCategories: [
        {
          items: [
            {
              id: 'item',
              name: 'Донер',
              price: new Prisma.Decimal(1200),
              isAvailable: true,
            },
          ],
        },
      ],
    };
    prisma.passengerProfile.findUnique.mockResolvedValue(passenger);
    prisma.merchant.findUnique.mockResolvedValue(merchant);
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        foodOrder: {
          create: jest.fn().mockImplementation(({ data }) => {
            expect(Number(data.subtotal)).toBe(2400);
            expect(Number(data.deliveryFee)).toBe(700);
            expect(Number(data.driverPayout)).toBe(700);
            expect(Number(data.totalPrice)).toBe(3100);
            return { id: 'order' };
          }),
        },
        promoCodeRedemption: { create: jest.fn() },
        promoCode: { update: jest.fn() },
      }),
    );
    prisma.foodOrder.findUnique.mockResolvedValue({
      id: 'order',
      passenger,
      merchant,
      driver: null,
      items: [],
      statusHistory: [],
    });

    const result = await service.createOrderForPassenger('passenger-user', {
      merchantId: 'merchant',
      deliveryAddress: 'Ушарал',
      items: [{ menuItemId: 'item', qty: 2 }],
      paymentMethod: PaymentMethod.KASPI_TRANSFER,
    });

    expect(result.id).toBe('order');
    expect(gateway.emitOrderCreated).toHaveBeenCalled();
  });

  it('allows only one driver to claim an available delivery', async () => {
    const { service, prisma } = makeService();
    prisma.driverProfile = {
      findUnique: jest.fn().mockResolvedValue({
        id: 'driver',
        userId: 'driver-user',
        status: 'APPROVED',
        supportsTaxi: true,
        supportsCourier: false,
      }),
    };
    prisma.foodOrder.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        foodOrder: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        foodOrderStatusHistory: { create: jest.fn() },
      }),
    );

    await expect(
      service.claimDelivery('driver-user', 'order'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('moves a prepared order to driver search and notifies available drivers', async () => {
    const { service, prisma, gateway } = makeService();
    prisma.merchant.findUnique.mockResolvedValue({
      id: 'merchant',
      userId: 'merchant-user',
    });
    prisma.foodOrder.findUnique
      .mockResolvedValueOnce({
        id: 'order',
        merchantId: 'merchant',
        status: FoodOrderStatus.PREPARING,
      })
      .mockResolvedValueOnce({
        id: 'order',
        status: FoodOrderStatus.SEARCHING_DRIVER,
        passenger: { userId: 'passenger-user', user: { pushToken: null } },
        merchant: { userId: 'merchant-user', name: 'Донер' },
        driver: null,
      });
    prisma.foodOrder.update.mockResolvedValue({});
    prisma.foodOrderStatusHistory.create.mockResolvedValue({});
    prisma.$transaction.mockImplementation(async (operations: Promise<any>[]) =>
      Promise.all(operations),
    );
    prisma.driverProfile = {
      findMany: jest.fn().mockResolvedValue([]),
    };

    await service.updateOrderStatusForMerchant(
      'merchant-user',
      'order',
      FoodOrderStatus.SEARCHING_DRIVER,
    );

    expect(gateway.emitDeliveryAvailable).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order' }),
      [],
    );
    expect(gateway.emitOrderUpdated).toHaveBeenCalled();
  });

  it('does not expose an order to an unrelated passenger', async () => {
    const { service, prisma } = makeService();
    prisma.foodOrder.findUnique.mockResolvedValue({
      id: 'order',
      passenger: { userId: 'owner' },
      merchant: { userId: 'merchant' },
      driver: null,
    });

    await expect(
      service.getOrderByIdForUser('stranger', UserRole.PASSENGER, 'order'),
    ).rejects.toThrow('Food order not found');
  });
});
