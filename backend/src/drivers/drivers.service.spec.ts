import { BadRequestException } from '@nestjs/common';
import { CourierTransportType, DocumentType, DriverMode, DriverStatus, RideStatus } from '@prisma/client';
import { DriversService } from './drivers.service';

describe('DriversService', () => {
  let prisma: any;
  let ridesGateway: { emitDriverMoved: jest.Mock };
  let redisService: any;
  let service: DriversService;

  beforeEach(() => {
    prisma = {
      driverProfile: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      ride: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      car: { update: jest.fn(), create: jest.fn() },
      driverDocument: { create: jest.fn() },
      courierOrder: { findMany: jest.fn() },
      $transaction: jest.fn(),
    };
    ridesGateway = { emitDriverMoved: jest.fn() };
    redisService = {
      onUserOffline: jest.fn(() => jest.fn()),
      clearCachedLocation: jest.fn(),
      getActiveAssignment: jest.fn(),
      clearActiveAssignment: jest.fn(),
      setActiveAssignment: jest.fn(),
      cacheLocation: jest.fn(),
      findNearbyUsers: jest.fn(),
      getCachedLocations: jest.fn(),
    };

    service = new DriversService(prisma, ridesGateway as any, redisService);
  });

  it('rejects going online in courier car mode without car info', async () => {
    prisma.driverProfile.findUnique.mockResolvedValue({
      userId: 'driver-user',
      status: DriverStatus.APPROVED,
      driverMode: DriverMode.COURIER,
      supportsCourier: true,
      courierTransportType: CourierTransportType.CAR,
      car: null,
      documents: [{ type: DocumentType.COURIER_ID, approved: true }],
    });

    await expect(service.setOnlineStatus('driver-user', true)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('uses redis assignment for current ride and avoids fallback query', async () => {
    prisma.driverProfile.findUnique.mockResolvedValue({ id: 'driver-1' });
    redisService.getActiveAssignment.mockResolvedValue({
      entityId: 'ride-1',
      status: RideStatus.ON_THE_WAY,
      updatedAt: new Date().toISOString(),
    });
    prisma.ride.findUnique.mockResolvedValue({
      id: 'ride-1',
      driverId: 'driver-1',
      status: RideStatus.ON_THE_WAY,
    });

    const result = await service.getCurrentRideForDriver('driver-user');

    expect(result).toEqual({
      id: 'ride-1',
      driverId: 'driver-1',
      status: RideStatus.ON_THE_WAY,
    });
    expect(prisma.ride.findFirst).not.toHaveBeenCalled();
  });

  it('caches location in redis and emits live movement for active ride', async () => {
    redisService.getActiveAssignment.mockResolvedValue({
      entityId: 'ride-1',
      status: RideStatus.ON_THE_WAY,
      updatedAt: new Date().toISOString(),
    });
    prisma.driverProfile.update.mockResolvedValue({});

    const result = await service.updateLocation('driver-user', 43.2, 76.9);

    expect(redisService.cacheLocation).toHaveBeenCalledWith('driver', 'driver-user', 43.2, 76.9);
    expect(prisma.driverProfile.update).toHaveBeenCalledWith({
      where: { userId: 'driver-user' },
      data: { lat: 43.2, lng: 76.9 },
    });
    expect(ridesGateway.emitDriverMoved).toHaveBeenCalledWith('ride-1', 43.2, 76.9);
    expect(result).toEqual({ success: true });
  });
});
