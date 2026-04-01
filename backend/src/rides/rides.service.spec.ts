import { BadRequestException } from '@nestjs/common';
import { RideStatus } from '@prisma/client';
import { RidesService } from './rides.service';

function createPrismaMock() {
  return {
    passengerProfile: { findUnique: jest.fn() },
    driverProfile: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    ride: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    tariff: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    rideStop: { create: jest.fn() },
    rideStatusHistory: { create: jest.fn() },
    $transaction: jest.fn(),
  };
}

describe('RidesService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let ridesGateway: { emitRideUpdated: jest.Mock; emitRideCreated: jest.Mock; emitRideOffer: jest.Mock; emitRideUpdatedToUser: jest.Mock };
  let notificationsService: { sendPush: jest.Mock };
  let redisService: {
    getActiveAssignment: jest.Mock;
    clearActiveAssignment: jest.Mock;
    setActiveAssignment: jest.Mock;
    findNearbyUsers: jest.Mock;
    getCachedLocations: jest.Mock;
  };
  let service: RidesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    ridesGateway = {
      emitRideUpdated: jest.fn(),
      emitRideCreated: jest.fn(),
      emitRideOffer: jest.fn(),
      emitRideUpdatedToUser: jest.fn(),
    };
    notificationsService = { sendPush: jest.fn() };
    redisService = {
      getActiveAssignment: jest.fn(),
      clearActiveAssignment: jest.fn(),
      setActiveAssignment: jest.fn(),
      findNearbyUsers: jest.fn(),
      getCachedLocations: jest.fn(),
    };

    service = new RidesService(
      prisma as any,
      ridesGateway as any,
      notificationsService as any,
      redisService as any,
    );
  });

  it('rejects ride acceptance when driver balance is below minimum', async () => {
    prisma.driverProfile.findUnique.mockResolvedValue({
      id: 'driver-1',
      balance: -600,
    });

    await expect(service.acceptRide('user-1', 'ride-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.ride.findUnique).not.toHaveBeenCalled();
  });

  it('returns current passenger ride from Redis assignment without fallback query', async () => {
    const ride = {
      id: 'ride-1',
      passengerId: 'passenger-1',
      status: RideStatus.ON_THE_WAY,
      passenger: { userId: 'user-1' },
      driver: { userId: 'driver-user-1' },
    };

    prisma.passengerProfile.findUnique.mockResolvedValue({ id: 'passenger-1' });
    redisService.getActiveAssignment.mockResolvedValue({
      entityId: 'ride-1',
      status: RideStatus.ON_THE_WAY,
      updatedAt: new Date().toISOString(),
    });
    prisma.ride.findUnique.mockResolvedValue(ride);

    const result = await service.getCurrentRideForPassenger('user-1');

    expect(result).toBe(ride);
    expect(prisma.ride.findFirst).not.toHaveBeenCalled();
    expect(redisService.clearActiveAssignment).not.toHaveBeenCalled();
  });
});
