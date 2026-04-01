import { BadRequestException } from '@nestjs/common';
import { IntercityOrderStatus } from '@prisma/client';
import { IntercityOrdersService } from './intercity-orders.service';

function createPrismaMock() {
  return {
    passengerProfile: { findUnique: jest.fn() },
    driverProfile: { findUnique: jest.fn() },
    intercityOrder: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    intercityOrderStatusHistory: { create: jest.fn() },
    $transaction: jest.fn(),
  };
}

describe('IntercityOrdersService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let gateway: { emitOrderUpdated: jest.Mock };
  let service: IntercityOrdersService;

  beforeEach(() => {
    prisma = createPrismaMock();
    gateway = { emitOrderUpdated: jest.fn() };
    service = new IntercityOrdersService(prisma as any, gateway as any);
  });

  it('creates confirmed order immediately when specific driver is selected', async () => {
    prisma.passengerProfile.findUnique.mockResolvedValue({ id: 'passenger-1' });
    prisma.intercityOrder.findFirst.mockResolvedValue(null);
    prisma.driverProfile.findUnique.mockResolvedValue({
      id: 'driver-1',
      supportsIntercity: true,
    });
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        intercityOrder: { create: jest.fn().mockResolvedValue({ id: 'order-1' }) },
        intercityOrderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      }),
    );

    const fullOrder = { id: 'order-1', status: IntercityOrderStatus.CONFIRMED };
    jest.spyOn(service, 'getOrderByIdForPassenger').mockResolvedValue(fullOrder as any);

    const result = await service.createOrderForPassenger('user-1', {
      fromCity: 'Алматы',
      toCity: 'Астана',
      departureAt: new Date('2026-04-01T10:00:00.000Z'),
      seats: 1,
      price: 15000,
      driverId: 'driver-1',
    });

    expect(result).toBe(fullOrder);
    expect(gateway.emitOrderUpdated).toHaveBeenCalledWith(fullOrder);
  });

  it('rejects passenger cancel when intercity order is already in progress', async () => {
    prisma.passengerProfile.findUnique.mockResolvedValue({ id: 'passenger-1' });
    prisma.intercityOrder.findUnique.mockResolvedValue({
      id: 'order-1',
      passengerId: 'passenger-1',
      status: IntercityOrderStatus.IN_PROGRESS,
    });

    await expect(
      service.cancelOrderByPassenger('user-1', 'order-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
