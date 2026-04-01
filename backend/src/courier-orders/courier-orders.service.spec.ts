import { BadRequestException } from '@nestjs/common';
import { CourierOrdersService } from './courier-orders.service';

function createPrismaMock() {
  return {
    passengerProfile: { findUnique: jest.fn() },
    driverProfile: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    courierOrder: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    courierOrderStatusHistory: { create: jest.fn() },
    $transaction: jest.fn(),
  };
}

describe('CourierOrdersService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let notificationsService: { sendPush: jest.Mock };
  let gateway: {
    emitOrderUpdated: jest.Mock;
    emitOrderCreated: jest.Mock;
    emitCourierOffer: jest.Mock;
    emitOrderUpdatedToUser: jest.Mock;
  };
  let redisService: {
    getActiveAssignment: jest.Mock;
    clearActiveAssignment: jest.Mock;
    setActiveAssignment: jest.Mock;
    findNearbyUsers: jest.Mock;
    getCachedLocations: jest.Mock;
  };
  let service: CourierOrdersService;

  beforeEach(() => {
    prisma = createPrismaMock();
    notificationsService = { sendPush: jest.fn() };
    gateway = {
      emitOrderUpdated: jest.fn(),
      emitOrderCreated: jest.fn(),
      emitCourierOffer: jest.fn(),
      emitOrderUpdatedToUser: jest.fn(),
    };
    redisService = {
      getActiveAssignment: jest.fn(),
      clearActiveAssignment: jest.fn(),
      setActiveAssignment: jest.fn(),
      findNearbyUsers: jest.fn(),
      getCachedLocations: jest.fn(),
    };

    service = new CourierOrdersService(
      prisma as any,
      notificationsService as any,
      gateway as any,
      redisService as any,
    );
  });

  it('rejects courier order creation without valid pickup/dropoff coordinates', async () => {
    prisma.passengerProfile.findUnique.mockResolvedValue({ id: 'passenger-1' });
    prisma.courierOrder.findFirst.mockResolvedValue(null);

    await expect(
      service.createOrderForPassenger('user-1', {
        pickupAddress: 'A',
        dropoffAddress: 'B',
        pickupLat: 0,
        pickupLng: 0,
        dropoffLat: 0,
        dropoffLng: 0,
        itemDescription: 'Box',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects order acceptance when courier is offline', async () => {
    prisma.driverProfile.findUnique.mockResolvedValue({
      id: 'driver-1',
      supportsCourier: true,
      isOnline: false,
    });

    await expect(service.acceptOrder('user-1', 'order-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
