import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  IntercityBookingCancelSource,
  IntercityBookingStatus,
  IntercityBookingType,
  IntercityTripStatus,
} from '@prisma/client';
import { IntercityTripsService } from './intercity-trips.service';

function makeService() {
  const prisma: any = {
    passengerProfile: { findUnique: jest.fn(), create: jest.fn() },
    driverProfile: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    intercityTrip: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    intercityBooking: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      updateMany: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: any) => unknown) => fn(prisma));
  const gateway = {
    emitTripUpdated: jest.fn(),
    emitBookingUpdated: jest.fn(),
    emitOrderUpdated: jest.fn(),
  };
  const redis = {};
  const notifications = { sendPush: jest.fn() };
  return {
    prisma,
    gateway,
    notifications,
    service: new IntercityTripsService(
      prisma,
      gateway as any,
      redis as any,
      notifications as any,
    ),
  };
}

const driver = { id: 'driver', userId: 'driver-user', car: null, documents: [] };
const passenger = { id: 'passenger', userId: 'passenger-user' };

function trip(overrides: Record<string, any> = {}) {
  return {
    id: 'trip',
    driverId: driver.id,
    status: IntercityTripStatus.PLANNED,
    seatCapacity: 4,
    offlineSeats: 0,
    pricePerSeat: 5000,
    fromCity: 'Ушарал',
    toCity: 'Талдыкорган',
    bookings: [],
    ...overrides,
  };
}

describe('IntercityTripsService seat honesty', () => {
  it('does not count seats taken outside the app as free', async () => {
    const { service, prisma } = makeService();
    prisma.intercityTrip.findMany
      .mockResolvedValueOnce([trip({ offlineSeats: 2, bookings: [{ seatsBooked: 1 }] })])
      .mockResolvedValueOnce([]);

    const [listed] = await service.listPublicTrips({});

    expect(listed.seatsRemaining).toBe(1);
  });

  it('refuses a booking for a seat the driver filled off the app', async () => {
    const { service, prisma } = makeService();
    prisma.passengerProfile.findUnique.mockResolvedValue(passenger);
    prisma.intercityTrip.findUnique.mockResolvedValue(trip({ offlineSeats: 4 }));
    prisma.intercityBooking.findFirst.mockResolvedValue(null);

    await expect(
      service.bookTrip('passenger-user', 'trip', {
        bookingType: IntercityBookingType.SEAT,
        seatsBooked: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.intercityBooking.create).not.toHaveBeenCalled();
  });

  it('refuses a full cabin once any seat is taken off the app', async () => {
    const { service, prisma } = makeService();
    prisma.passengerProfile.findUnique.mockResolvedValue(passenger);
    prisma.intercityTrip.findUnique.mockResolvedValue(trip({ offlineSeats: 1 }));
    prisma.intercityBooking.findFirst.mockResolvedValue(null);

    await expect(
      service.bookTrip('passenger-user', 'trip', {
        bookingType: IntercityBookingType.FULL_CABIN,
        seatsBooked: 4,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lets the driver mark the car full but not take booked seats', async () => {
    const { service, prisma } = makeService();
    prisma.driverProfile.findUnique.mockResolvedValue(driver);
    prisma.intercityTrip.findUnique.mockResolvedValue(
      trip({ bookings: [{ seatsBooked: 1 }] }),
    );

    await expect(service.setOfflineSeats('driver-user', 'trip', 4)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.intercityTrip.update).not.toHaveBeenCalled();

    await service.setOfflineSeats('driver-user', 'trip', 3);
    expect(prisma.intercityTrip.update).toHaveBeenCalledWith({
      where: { id: 'trip' },
      data: { offlineSeats: 3 },
    });
  });

  it('refuses to change seats after the car has left', async () => {
    const { service, prisma } = makeService();
    prisma.driverProfile.findUnique.mockResolvedValue(driver);
    prisma.intercityTrip.findUnique.mockResolvedValue(
      trip({ status: IntercityTripStatus.IN_PROGRESS }),
    );

    await expect(service.setOfflineSeats('driver-user', 'trip', 1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('lets a passenger give their seat back and tells the driver', async () => {
    const { service, prisma, notifications } = makeService();
    prisma.passengerProfile.findUnique.mockResolvedValue(passenger);
    prisma.driverProfile.findUnique.mockResolvedValue(driver);
    prisma.intercityBooking.findUnique
      .mockResolvedValueOnce({
        id: 'booking',
        tripId: 'trip',
        passengerId: passenger.id,
        trip: { driver: { userId: 'driver-user', user: { pushToken: 'driver-token' } } },
      });
    prisma.intercityBooking.updateMany.mockResolvedValue({ count: 1 });
    prisma.intercityBooking.findUniqueOrThrow.mockResolvedValue({
      id: 'booking',
      seatsBooked: 2,
      status: IntercityBookingStatus.CANCELED,
      passenger: { fullName: 'Айгерим', user: {} },
    });
    prisma.intercityTrip.findUnique.mockResolvedValue(trip());

    await service.cancelBookingByPassenger('passenger-user', 'booking');

    expect(prisma.intercityBooking.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'booking',
        status: { in: [IntercityBookingStatus.CONFIRMED, IntercityBookingStatus.BOARDING] },
      },
      data: expect.objectContaining({
        status: IntercityBookingStatus.CANCELED,
        canceledBy: IntercityBookingCancelSource.PASSENGER,
      }),
    });
    expect(notifications.sendPush).toHaveBeenCalledWith(
      'driver-token',
      expect.objectContaining({ title: 'Пассажир отменил бронь' }),
    );
  });

  it('refuses to cancel a booking once the car has left', async () => {
    const { service, prisma } = makeService();
    prisma.passengerProfile.findUnique.mockResolvedValue(passenger);
    prisma.intercityBooking.findUnique.mockResolvedValue({
      id: 'booking',
      tripId: 'trip',
      passengerId: passenger.id,
      trip: { driver: { userId: 'driver-user', user: {} } },
    });
    prisma.intercityBooking.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.cancelBookingByPassenger('passenger-user', 'booking'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("does not let a driver remove a passenger from someone else's trip", async () => {
    const { service, prisma } = makeService();
    prisma.driverProfile.findUnique.mockResolvedValue(driver);
    prisma.intercityBooking.findUnique.mockResolvedValue({
      id: 'booking',
      tripId: 'trip',
      trip: trip({ driverId: 'other-driver' }),
    });

    await expect(
      service.removeBookingByDriver('driver-user', 'trip', 'booking'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.intercityBooking.updateMany).not.toHaveBeenCalled();
  });

  it("shows a driver's recent cancellations next to their trips", async () => {
    const { service, prisma } = makeService();
    prisma.intercityTrip.findMany
      .mockResolvedValueOnce([trip()])
      // One trip canceled with passengers on it...
      .mockResolvedValueOnce([{ driverId: driver.id }]);
    // ...and one passenger the driver took out.
    prisma.intercityBooking.findMany.mockResolvedValueOnce([{ trip: { driverId: driver.id } }]);

    const [listed] = await service.listPublicTrips({});

    expect(listed.driverCancelCount).toBe(2);
  });

  it("shows the driver each passenger's recent cancellations", async () => {
    const { service, prisma } = makeService();
    prisma.driverProfile.findUnique.mockResolvedValue(driver);
    prisma.intercityTrip.findUnique.mockResolvedValue(
      trip({ bookings: [{ id: 'booking', passengerId: passenger.id, seatsBooked: 1 }] }),
    );
    prisma.intercityBooking.groupBy.mockResolvedValue([
      { passengerId: passenger.id, _count: { _all: 3 } },
    ]);

    const shown = await service.getTripForDriver('driver-user', 'trip');

    expect(shown.bookings[0].passengerCancelCount).toBe(3);
    expect(prisma.intercityBooking.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ canceledBy: IntercityBookingCancelSource.PASSENGER }),
      }),
    );
  });
});
