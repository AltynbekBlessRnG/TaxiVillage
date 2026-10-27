import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentType,
  DriverStatus,
  DriverMode,
  IntercityOrderStatus,
  IntercityBookingCancelSource,
  IntercityBookingStatus,
  IntercityBookingType,
  IntercityTripInviteStatus,
  IntercityTripStatus,
  Prisma,
} from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service';
import { IntercityGateway } from './intercity.gateway';
import { RedisService } from '../redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Bookings that still hold a seat in the car. */
const ACTIVE_BOOKING_STATUSES: IntercityBookingStatus[] = [
  IntercityBookingStatus.CONFIRMED,
  IntercityBookingStatus.BOARDING,
  IntercityBookingStatus.IN_PROGRESS,
];

/** A passenger can still step out, or be taken out, until the car leaves. */
const CANCELABLE_BOOKING_STATUSES: IntercityBookingStatus[] = [
  IntercityBookingStatus.CONFIRMED,
  IntercityBookingStatus.BOARDING,
];

/** How far back cancellations count toward someone's record. */
const CANCEL_HISTORY_DAYS = 90;

/** Seats nobody holds, in the app or off it. */
function freeSeats(
  trip: { seatCapacity: number; offlineSeats: number },
  activeBookings: Array<{ seatsBooked: number }>,
) {
  const booked = activeBookings.reduce((sum, booking) => sum + booking.seatsBooked, 0);
  return Math.max(trip.seatCapacity - trip.offlineSeats - booked, 0);
}

@Injectable()
export class IntercityTripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intercityGateway: IntercityGateway,
    private readonly redisService: RedisService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listPublicTrips(filters: {
    dateFrom?: string;
    fromCity?: string;
    toCity?: string;
    minPrice?: number;
    maxPrice?: number;
    seatsRequired?: number;
    baggageRequired?: boolean;
    womenOnly?: boolean;
    noAnimals?: boolean;
  }) {
    const departureFrom = (() => {
      if (!filters.dateFrom) {
        return undefined;
      }

      const normalized =
        filters.dateFrom.length <= 10 ? `${filters.dateFrom}T00:00:00` : filters.dateFrom;
      const parsed = new Date(normalized);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    })();

    const trips = await this.prisma.intercityTrip.findMany({
      where: {
        status: IntercityTripStatus.PLANNED,
        fromCity: filters.fromCity ? { contains: filters.fromCity, mode: 'insensitive' } : undefined,
        toCity: filters.toCity ? { contains: filters.toCity, mode: 'insensitive' } : undefined,
        departureAt: departureFrom ? { gte: departureFrom } : undefined,
        womenOnly: filters.womenOnly ? true : undefined,
        baggageSpace: filters.baggageRequired ? true : undefined,
        allowAnimals: filters.noAnimals ? false : undefined,
        pricePerSeat: {
          gte: typeof filters.minPrice === 'number' ? filters.minPrice : undefined,
          lte: typeof filters.maxPrice === 'number' ? filters.maxPrice : undefined,
        },
      },
      include: this.publicTripInclude(),
      orderBy: [{ departureAt: 'asc' }, { createdAt: 'desc' }],
    });

    const driverCancels = await this.countDriverCancels(trips.map((trip) => trip.driverId));

    return trips
      .map((trip) => ({
        ...trip,
        seatsRemaining: freeSeats(trip, trip.bookings),
        driverCancelCount: driverCancels.get(trip.driverId) ?? 0,
        bookings: undefined,
      }))
      .filter((trip) =>
        typeof filters.seatsRequired === 'number' ? trip.seatsRemaining >= filters.seatsRequired : true,
      );
  }

  async listPopularRoutes() {
    const [trips, orders] = await Promise.all([
      this.prisma.intercityTrip.findMany({
        where: {
          departureAt: { gte: new Date() },
          status: { in: [IntercityTripStatus.PLANNED, IntercityTripStatus.BOARDING] },
        },
        select: { fromCity: true, toCity: true },
        take: 200,
      }),
      this.prisma.intercityOrder.findMany({
        where: {
          departureAt: { gte: new Date() },
          status: { in: [IntercityOrderStatus.SEARCHING_DRIVER, IntercityOrderStatus.CONFIRMED] },
        },
        select: { fromCity: true, toCity: true },
        take: 200,
      }),
    ]);

    const routeCounts = new Map<string, { fromCity: string; toCity: string; demand: number }>();

    [...trips, ...orders].forEach((route) => {
      const key = `${route.fromCity}::${route.toCity}`;
      const current = routeCounts.get(key);
      if (current) {
        current.demand += 1;
      } else {
        routeCounts.set(key, { fromCity: route.fromCity, toCity: route.toCity, demand: 1 });
      }
    });

    return Array.from(routeCounts.values())
      .sort((a, b) => b.demand - a.demand || a.toCity.localeCompare(b.toCity))
      .slice(0, 8);
  }

  async listMyTrips(userId: string) {
    const driver = await this.requireDriver(userId);
    return this.prisma.intercityTrip.findMany({
      where: { driverId: driver.id },
      include: this.driverTripInclude(),
      orderBy: [{ departureAt: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getCurrentTrip(userId: string) {
    const driver = await this.requireDriver(userId);
    const activeStatuses: IntercityTripStatus[] = [
      IntercityTripStatus.PLANNED,
      IntercityTripStatus.BOARDING,
      IntercityTripStatus.IN_PROGRESS,
    ];
    const assignment = await this.redisService.getActiveAssignment('intercity-trip', userId);

    if (assignment?.entityId) {
      const tripFromRedis = await this.prisma.intercityTrip.findUnique({
        where: { id: assignment.entityId },
        include: this.driverTripInclude(),
      });

      if (
        tripFromRedis &&
        tripFromRedis.driverId === driver.id &&
        activeStatuses.includes(tripFromRedis.status)
      ) {
        return tripFromRedis;
      }

      await this.redisService.clearActiveAssignment('intercity-trip', userId);
    }

    const trip = await this.prisma.intercityTrip.findFirst({
      where: {
        driverId: driver.id,
        status: {
          in: [IntercityTripStatus.PLANNED, IntercityTripStatus.BOARDING, IntercityTripStatus.IN_PROGRESS],
        },
      },
      include: this.driverTripInclude(),
      orderBy: [{ departureAt: 'asc' }, { createdAt: 'desc' }],
    });

    if (trip?.id) {
      await this.redisService.setActiveAssignment('intercity-trip', userId, trip.id, trip.status);
    } else {
      await this.redisService.clearActiveAssignment('intercity-trip', userId);
    }

    return trip;
  }

  async createTrip(
    userId: string,
    data: {
      fromCity: string;
      toCity: string;
      departureAt: Date;
      pricePerSeat: number;
      seatCapacity: number;
      comment?: string;
      stops?: string[];
      womenOnly?: boolean;
      baggageSpace?: boolean;
      allowAnimals?: boolean;
      departWhenFull?: boolean;
    },
  ) {
    const driver = await this.requireDriver(userId, true);

    const existingActiveTrip = await this.prisma.intercityTrip.findFirst({
      where: {
        driverId: driver.id,
        status: {
          in: [IntercityTripStatus.PLANNED, IntercityTripStatus.BOARDING, IntercityTripStatus.IN_PROGRESS],
        },
      },
    });
    if (existingActiveTrip) {
      throw new BadRequestException('Сначала завершите или отмените текущий межгородний рейс');
    }

    const trip = await this.prisma.$transaction(async (tx) => {
      const created = await tx.intercityTrip.create({
        data: {
          driverId: driver.id,
          fromCity: data.fromCity,
          toCity: data.toCity,
          departureAt: data.departureAt,
          pricePerSeat: new Prisma.Decimal(data.pricePerSeat),
          seatCapacity: data.seatCapacity,
          comment: data.comment || null,
          stops: data.stops?.length ? data.stops : undefined,
          womenOnly: data.womenOnly ?? false,
          baggageSpace: data.baggageSpace ?? true,
          allowAnimals: data.allowAnimals ?? true,
          departWhenFull: data.departWhenFull ?? false,
          carMake: driver.car?.make || null,
          carModel: driver.car?.model || null,
          carColor: driver.car?.color || null,
          plateNumber: driver.car?.plateNumber || null,
          status: IntercityTripStatus.PLANNED,
        },
      });

      await tx.intercityTripStatusHistory.create({
        data: {
          intercityTripId: created.id,
          status: IntercityTripStatus.PLANNED,
        },
      });

      await tx.driverProfile.update({
        where: { id: driver.id },
        data: { driverMode: DriverMode.INTERCITY },
      });

      return created;
    });

    const fullTrip = await this.getTripForDriver(userId, trip.id);
    await this.redisService.setActiveAssignment('intercity-trip', userId, fullTrip.id, fullTrip.status);
    return fullTrip;
  }

  async getTripForDriver(userId: string, tripId: string) {
    const driver = await this.requireDriver(userId);
    const trip = await this.prisma.intercityTrip.findUnique({
      where: { id: tripId },
      include: this.driverTripInclude(),
    });
    if (!trip || trip.driverId !== driver.id) {
      throw new NotFoundException('Intercity trip not found');
    }
    const passengerCancels = await this.countPassengerCancels(
      trip.bookings.map((booking) => booking.passengerId),
    );
    return {
      ...trip,
      bookings: trip.bookings.map((booking) => ({
        ...booking,
        passengerCancelCount: passengerCancels.get(booking.passengerId) ?? 0,
      })),
    };
  }

  /**
   * Bookings each passenger gave back lately, so a driver can tell a
   * reliable passenger from one who books three trips and rides one.
   */
  private async countPassengerCancels(passengerIds: string[]) {
    const counts = new Map<string, number>();
    if (!passengerIds.length) {
      return counts;
    }
    const rows = await this.prisma.intercityBooking.groupBy({
      by: ['passengerId'],
      where: {
        passengerId: { in: Array.from(new Set(passengerIds)) },
        canceledBy: IntercityBookingCancelSource.PASSENGER,
        canceledAt: { gte: this.cancelHistoryStart() },
      },
      _count: { _all: true },
    });
    rows.forEach((row) => counts.set(row.passengerId, row._count._all));
    return counts;
  }

  /**
   * Trips each driver canceled with passengers on board, plus passengers
   * the driver took out, lately. A trip canceled before anyone booked it
   * hurts nobody and is not counted.
   */
  private async countDriverCancels(driverIds: string[]) {
    const counts = new Map<string, number>();
    if (!driverIds.length) {
      return counts;
    }
    const since = this.cancelHistoryStart();
    const [canceledTrips, removedBookings] = await Promise.all([
      this.prisma.intercityTrip.findMany({
        where: {
          driverId: { in: Array.from(new Set(driverIds)) },
          status: IntercityTripStatus.CANCELED,
          bookings: {
            some: {
              canceledBy: IntercityBookingCancelSource.TRIP_CANCELED,
              canceledAt: { gte: since },
            },
          },
        },
        select: { driverId: true },
      }),
      this.prisma.intercityBooking.findMany({
        where: {
          canceledBy: IntercityBookingCancelSource.DRIVER,
          canceledAt: { gte: since },
          trip: { driverId: { in: Array.from(new Set(driverIds)) } },
        },
        select: { trip: { select: { driverId: true } } },
      }),
    ]);
    canceledTrips.forEach(({ driverId }) => counts.set(driverId, (counts.get(driverId) ?? 0) + 1));
    removedBookings.forEach(({ trip }) =>
      counts.set(trip.driverId, (counts.get(trip.driverId) ?? 0) + 1),
    );
    return counts;
  }

  private cancelHistoryStart() {
    return new Date(Date.now() - CANCEL_HISTORY_DAYS * 24 * 60 * 60 * 1000);
  }

  async getBookingForPassenger(userId: string, bookingId: string) {
    const passenger = await this.requirePassenger(userId);
    const booking = await this.prisma.intercityBooking.findUnique({
      where: { id: bookingId },
      include: this.passengerBookingInclude(),
    });
    if (!booking || booking.passengerId !== passenger.id) {
      throw new NotFoundException('Intercity booking not found');
    }
    return booking;
  }

  async listBookingsForPassenger(userId: string) {
    const passenger = await this.requirePassenger(userId);
    return this.prisma.intercityBooking.findMany({
      where: { passengerId: passenger.id },
      include: this.passengerBookingInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async bookTrip(
    userId: string,
    tripId: string,
    data: { bookingType: IntercityBookingType; seatsBooked: number; comment?: string },
  ) {
    const passenger = await this.requirePassenger(userId);
    const booking = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "IntercityTrip" WHERE id = ${tripId} FOR UPDATE`;

      const trip = await tx.intercityTrip.findUnique({
        where: { id: tripId },
        include: {
          bookings: {
            where: {
              status: {
                in: [
                  IntercityBookingStatus.CONFIRMED,
                  IntercityBookingStatus.BOARDING,
                  IntercityBookingStatus.IN_PROGRESS,
                ],
              },
            },
          },
        },
      });

      if (!trip || trip.status !== IntercityTripStatus.PLANNED) {
        throw new NotFoundException('Рейс недоступен для бронирования');
      }

      const existingBooking = await tx.intercityBooking.findFirst({
        where: {
          tripId,
          passengerId: passenger.id,
          status: {
            in: [
              IntercityBookingStatus.CONFIRMED,
              IntercityBookingStatus.BOARDING,
              IntercityBookingStatus.IN_PROGRESS,
            ],
          },
        },
      });
      if (existingBooking) {
        throw new BadRequestException('У вас уже есть активная бронь на этот рейс');
      }

      const remainingSeats = freeSeats(trip, trip.bookings);

      let seatsBooked = data.seatsBooked;
      if (data.bookingType === IntercityBookingType.FULL_CABIN) {
        if (remainingSeats < trip.seatCapacity) {
          throw new BadRequestException('Полный салон можно забронировать только если мест еще никто не занял');
        }
        seatsBooked = trip.seatCapacity;
      }

      if (seatsBooked < 1 || seatsBooked > remainingSeats) {
        throw new BadRequestException('Недостаточно свободных мест на рейсе');
      }

      return tx.intercityBooking.create({
        data: {
          tripId,
          passengerId: passenger.id,
          bookingType: data.bookingType,
          seatsBooked,
          totalPrice: new Prisma.Decimal(Number(trip.pricePerSeat) * seatsBooked),
          comment: data.comment || null,
          status: IntercityBookingStatus.CONFIRMED,
        },
        include: this.passengerBookingInclude(),
      });
    });

    this.intercityGateway.emitBookingUpdated(booking);
    return booking;
  }

  async inviteOrderToTrip(
    userId: string,
    tripId: string,
    orderId: string,
    message?: string,
  ) {
    const driver = await this.requireDriver(userId, true);
    const trip = await this.prisma.intercityTrip.findUnique({
      where: { id: tripId },
      include: {
        driver: { include: { user: true } },
        bookings: {
          where: {
            status: {
              in: [
                IntercityBookingStatus.CONFIRMED,
                IntercityBookingStatus.BOARDING,
                IntercityBookingStatus.IN_PROGRESS,
              ],
            },
          },
        },
      },
    });

    if (!trip || trip.driverId !== driver.id) {
      throw new NotFoundException('Рейс не найден');
    }
    if (trip.status !== IntercityTripStatus.PLANNED) {
      throw new BadRequestException('Приглашать пассажиров можно только в запланированный рейс');
    }

    const order = await this.prisma.intercityOrder.findUnique({
      where: { id: orderId },
      include: {
        passenger: { include: { user: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Заявка не найдена');
    }
    if (order.driverId) {
      throw new BadRequestException('У заявки уже есть водитель');
    }
    if (order.status !== IntercityOrderStatus.SEARCHING_DRIVER) {
      throw new BadRequestException('Пригласить можно только активную заявку без водителя');
    }
    if (trip.fromCity.trim().toLowerCase() !== order.fromCity.trim().toLowerCase() || trip.toCity.trim().toLowerCase() !== order.toCity.trim().toLowerCase()) {
      throw new BadRequestException('Маршрут заявки не совпадает с маршрутом рейса');
    }

    if (freeSeats(trip, trip.bookings) < order.seats) {
      throw new BadRequestException('В рейсе недостаточно мест для этой заявки');
    }

    const existingPendingInvite = await this.prisma.intercityTripInvite.findFirst({
      where: {
        tripId,
        orderId,
        status: IntercityTripInviteStatus.PENDING,
      },
    });
    if (existingPendingInvite) {
      throw new BadRequestException('Приглашение в этот рейс уже отправлено');
    }

    const createdInvite = await this.prisma.$transaction(async (tx) => {
      await tx.intercityTripInvite.updateMany({
        where: {
          orderId,
          status: IntercityTripInviteStatus.PENDING,
        },
        data: {
          status: IntercityTripInviteStatus.CANCELED,
          respondedAt: new Date(),
        },
      });

      return tx.intercityTripInvite.create({
        data: {
          tripId,
          orderId,
          seatsOffered: order.seats,
          priceOffered: new Prisma.Decimal(Number(trip.pricePerSeat) * order.seats),
          message: message?.trim() || null,
        },
        include: this.tripInviteInclude(),
      });
    });

    const refreshedOrder = await this.prisma.intercityOrder.findUnique({
      where: { id: orderId },
      include: this.getOrderWithInvitesInclude(),
    });
    if (refreshedOrder) {
      this.intercityGateway.emitOrderUpdated(refreshedOrder);
    }

    await this.notificationsService.sendPush(order.passenger?.user?.pushToken, {
      title: 'Новое приглашение в рейс',
      body: `${trip.driver.fullName || trip.driver.user.phone || 'Водитель'} приглашает вас в рейс ${trip.fromCity} → ${trip.toCity}`,
      data: {
        type: 'INTERCITY_TRIP_INVITE',
        orderId,
        inviteId: createdInvite.id,
      },
    });

    return createdInvite;
  }

  async acceptInvite(userId: string, inviteId: string) {
    const passenger = await this.requirePassenger(userId);
    let tripDriverUserId = '';
    let orderId = '';
    const booking = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "IntercityTripInvite" WHERE id = ${inviteId} FOR UPDATE`;

      const invite = await tx.intercityTripInvite.findUnique({
        where: { id: inviteId },
        include: this.tripInviteInclude(),
      });

      if (!invite || invite.order.passengerId !== passenger.id) {
        throw new NotFoundException('Приглашение не найдено');
      }
      if (invite.status !== IntercityTripInviteStatus.PENDING) {
        throw new BadRequestException('Приглашение уже неактуально');
      }

      await tx.$queryRaw`SELECT id FROM "IntercityTrip" WHERE id = ${invite.tripId} FOR UPDATE`;
      const trip = await tx.intercityTrip.findUnique({
        where: { id: invite.tripId },
        include: {
          driver: { include: { user: true } },
          bookings: {
            where: {
              status: {
                in: [
                  IntercityBookingStatus.CONFIRMED,
                  IntercityBookingStatus.BOARDING,
                  IntercityBookingStatus.IN_PROGRESS,
                ],
              },
            },
          },
        },
      });

      if (!trip || trip.status !== IntercityTripStatus.PLANNED) {
        throw new BadRequestException('Рейс уже недоступен');
      }

      const activeBooking = await tx.intercityBooking.findFirst({
        where: {
          passengerId: passenger.id,
          status: {
            in: [
              IntercityBookingStatus.CONFIRMED,
              IntercityBookingStatus.BOARDING,
              IntercityBookingStatus.IN_PROGRESS,
            ],
          },
        },
      });
      if (activeBooking) {
        throw new BadRequestException('У вас уже есть активная бронь на межгород');
      }

      if (freeSeats(trip, trip.bookings) < invite.seatsOffered) {
        throw new BadRequestException('В рейсе уже не осталось нужного количества мест');
      }

      const createdBooking = await tx.intercityBooking.create({
        data: {
          tripId: invite.tripId,
          passengerId: passenger.id,
          bookingType:
            invite.seatsOffered >= trip.seatCapacity
              ? IntercityBookingType.FULL_CABIN
              : IntercityBookingType.SEAT,
          seatsBooked: invite.seatsOffered,
          totalPrice: invite.priceOffered,
          comment: invite.order.comment || invite.message || null,
          status: IntercityBookingStatus.CONFIRMED,
        },
        include: this.passengerBookingInclude(),
      });

      await tx.intercityTripInvite.update({
        where: { id: inviteId },
        data: {
          status: IntercityTripInviteStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      });

      await tx.intercityTripInvite.updateMany({
        where: {
          orderId: invite.orderId,
          status: IntercityTripInviteStatus.PENDING,
          NOT: { id: inviteId },
        },
        data: {
          status: IntercityTripInviteStatus.CANCELED,
          respondedAt: new Date(),
        },
      });

      await tx.intercityOrder.update({
        where: { id: invite.orderId },
        data: {
          driverId: invite.trip.driverId,
          status: IntercityOrderStatus.COMPLETED,
        },
      });

      await tx.intercityOrderStatusHistory.create({
        data: {
          intercityOrderId: invite.orderId,
          status: IntercityOrderStatus.COMPLETED,
        },
      });

      tripDriverUserId = trip.driver.userId;
      orderId = invite.orderId;
      return createdBooking;
    });

    const updatedOrder = await this.prisma.intercityOrder.findUnique({
      where: { id: orderId },
      include: this.getOrderWithInvitesInclude(),
    });
    if (updatedOrder) {
      this.intercityGateway.emitOrderUpdated(updatedOrder);
    }
    const updatedTrip = await this.getTripForDriver(tripDriverUserId, booking.tripId);
    this.intercityGateway.emitTripUpdated(updatedTrip);
    this.intercityGateway.emitBookingUpdated(booking);
    await this.notificationsService.sendPush(updatedTrip.driver.user?.pushToken, {
      title: 'Пассажир принял приглашение',
      body: `${booking.passenger.fullName || booking.passenger.user?.phone || 'Пассажир'} вошел в ваш рейс`,
      data: {
        type: 'INTERCITY_TRIP_STATUS',
        tripId: booking.tripId,
      },
    });

    return booking;
  }

  async declineInvite(userId: string, inviteId: string) {
    const passenger = await this.requirePassenger(userId);
    const invite = await this.prisma.intercityTripInvite.findUnique({
      where: { id: inviteId },
      include: this.tripInviteInclude(),
    });

    if (!invite || invite.order.passengerId !== passenger.id) {
      throw new NotFoundException('Приглашение не найдено');
    }
    if (invite.status !== IntercityTripInviteStatus.PENDING) {
      throw new BadRequestException('Приглашение уже неактуально');
    }

    const updatedInvite = await this.prisma.intercityTripInvite.update({
      where: { id: inviteId },
      data: {
        status: IntercityTripInviteStatus.DECLINED,
        respondedAt: new Date(),
      },
      include: this.tripInviteInclude(),
    });

    const updatedOrder = await this.prisma.intercityOrder.findUnique({
      where: { id: invite.orderId },
      include: this.getOrderWithInvitesInclude(),
    });
    if (updatedOrder) {
      this.intercityGateway.emitOrderUpdated(updatedOrder);
    }
    await this.notificationsService.sendPush(invite.trip.driver.user?.pushToken, {
      title: 'Пассажир отклонил приглашение',
      body: `${invite.order.passenger.fullName || invite.order.passenger.user?.phone || 'Пассажир'} отказался от места в рейсе`,
      data: {
        type: 'INTERCITY_TRIP_STATUS',
        tripId: invite.tripId,
      },
    });

    return updatedInvite;
  }

  async updateTripStatus(userId: string, tripId: string, status: IntercityTripStatus) {
    const driver = await this.requireDriver(userId);
    const trip = await this.prisma.intercityTrip.findUnique({
      where: { id: tripId },
    });

    if (!trip || trip.driverId !== driver.id) {
      throw new NotFoundException('Intercity trip not found');
    }

    this.assertAllowedTripTransition(trip.status, status);

    await this.prisma.$transaction(async (tx) => {
      await tx.intercityTrip.update({
        where: { id: tripId },
        data: { status },
      });
      await tx.intercityTripStatusHistory.create({
        data: {
          intercityTripId: tripId,
          status,
        },
      });

      if (status === IntercityTripStatus.BOARDING) {
        await tx.intercityBooking.updateMany({
          where: { tripId, status: IntercityBookingStatus.CONFIRMED },
          data: { status: IntercityBookingStatus.BOARDING },
        });
      } else if (status === IntercityTripStatus.IN_PROGRESS) {
        await tx.intercityBooking.updateMany({
          where: {
            tripId,
            status: { in: [IntercityBookingStatus.CONFIRMED, IntercityBookingStatus.BOARDING] },
          },
          data: { status: IntercityBookingStatus.IN_PROGRESS },
        });
      } else if (status === IntercityTripStatus.COMPLETED) {
        await tx.intercityBooking.updateMany({
          where: {
            tripId,
            status: {
              in: [
                IntercityBookingStatus.CONFIRMED,
                IntercityBookingStatus.BOARDING,
                IntercityBookingStatus.IN_PROGRESS,
              ],
            },
          },
          data: { status: IntercityBookingStatus.COMPLETED },
        });
      } else if (status === IntercityTripStatus.CANCELED) {
        await tx.intercityBooking.updateMany({
          where: {
            tripId,
            status: {
              in: [
                IntercityBookingStatus.CONFIRMED,
                IntercityBookingStatus.BOARDING,
                IntercityBookingStatus.IN_PROGRESS,
              ],
            },
          },
          data: {
            status: IntercityBookingStatus.CANCELED,
            canceledAt: new Date(),
            canceledBy: IntercityBookingCancelSource.TRIP_CANCELED,
          },
        });
      }
    });

    const updatedTrip = await this.getTripForDriver(userId, tripId);
    this.intercityGateway.emitTripUpdated(updatedTrip);

    const finishedTripStatuses: IntercityTripStatus[] = [
      IntercityTripStatus.COMPLETED,
      IntercityTripStatus.CANCELED,
    ];

    if (finishedTripStatuses.includes(updatedTrip.status)) {
      await this.redisService.clearActiveAssignment('intercity-trip', userId);
    } else {
      await this.redisService.setActiveAssignment('intercity-trip', userId, updatedTrip.id, updatedTrip.status);
    }

    // Passengers who already left the trip are no longer told about it.
    const affectedBookings = await this.prisma.intercityBooking.findMany({
      where: { tripId, ...this.stillOnTripWhere() },
      include: this.passengerBookingInclude(),
    });
    affectedBookings.forEach((booking) => this.intercityGateway.emitBookingUpdated(booking));

    await Promise.all(
      affectedBookings.map((booking) =>
        this.notificationsService.sendPush(booking.passenger?.user?.pushToken, {
          title: 'Статус рейса обновлен',
          body: this.buildTripStatusNotificationBody(updatedTrip.status),
          data: {
            type: 'INTERCITY_TRIP_STATUS',
            bookingId: booking.id,
          },
        }),
      ),
    );

    return updatedTrip;
  }

  /**
   * The driver marks seats taken outside the app, up to "the car is full",
   * so the public listing stops offering them.
   */
  async setOfflineSeats(userId: string, tripId: string, offlineSeats: number) {
    const driver = await this.requireDriver(userId);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "IntercityTrip" WHERE id = ${tripId} FOR UPDATE`;
      const trip = await tx.intercityTrip.findUnique({
        where: { id: tripId },
        include: { bookings: { where: { status: { in: ACTIVE_BOOKING_STATUSES } } } },
      });
      if (!trip || trip.driverId !== driver.id) {
        throw new NotFoundException('Рейс не найден');
      }
      const editableStatuses: IntercityTripStatus[] = [
        IntercityTripStatus.PLANNED,
        IntercityTripStatus.BOARDING,
      ];
      if (!editableStatuses.includes(trip.status)) {
        throw new BadRequestException('Места можно менять только до выезда');
      }
      const booked = trip.bookings.reduce((sum, booking) => sum + booking.seatsBooked, 0);
      const maxOffline = Math.max(trip.seatCapacity - booked, 0);
      if (offlineSeats < 0 || offlineSeats > maxOffline) {
        throw new BadRequestException(
          `Можно отметить от 0 до ${maxOffline} мест: остальные уже забронированы в приложении`,
        );
      }
      await tx.intercityTrip.update({ where: { id: tripId }, data: { offlineSeats } });
    });

    const updatedTrip = await this.getTripForDriver(userId, tripId);
    this.intercityGateway.emitTripUpdated(updatedTrip);
    return updatedTrip;
  }

  async cancelBookingByPassenger(userId: string, bookingId: string) {
    const passenger = await this.requirePassenger(userId);
    const booking = await this.prisma.intercityBooking.findUnique({
      where: { id: bookingId },
      include: { trip: { include: { driver: { include: { user: true } } } } },
    });
    if (!booking || booking.passengerId !== passenger.id) {
      throw new NotFoundException('Бронь не найдена');
    }

    const canceled = await this.cancelBooking(booking.id, IntercityBookingCancelSource.PASSENGER);
    const updatedTrip = await this.getTripForDriver(booking.trip.driver.userId, booking.tripId);
    this.intercityGateway.emitTripUpdated(updatedTrip);
    await this.notificationsService.sendPush(booking.trip.driver.user?.pushToken, {
      title: 'Пассажир отменил бронь',
      body: `${canceled.passenger.fullName || canceled.passenger.user?.phone || 'Пассажир'} не поедет. Освободилось мест: ${canceled.seatsBooked}`,
      data: { type: 'INTERCITY_TRIP_STATUS', tripId: booking.tripId },
    });
    return canceled;
  }

  async removeBookingByDriver(userId: string, tripId: string, bookingId: string) {
    const driver = await this.requireDriver(userId);
    const booking = await this.prisma.intercityBooking.findUnique({
      where: { id: bookingId },
      include: { trip: true },
    });
    if (!booking || booking.tripId !== tripId || booking.trip.driverId !== driver.id) {
      throw new NotFoundException('Бронь не найдена');
    }

    const canceled = await this.cancelBooking(booking.id, IntercityBookingCancelSource.DRIVER);
    const updatedTrip = await this.getTripForDriver(userId, tripId);
    this.intercityGateway.emitTripUpdated(updatedTrip);
    await this.notificationsService.sendPush(canceled.passenger.user?.pushToken, {
      title: 'Бронь отменена водителем',
      body: `Водитель снял вашу бронь на рейс ${booking.trip.fromCity} → ${booking.trip.toCity}. Поищите другой рейс.`,
      data: { type: 'INTERCITY_TRIP_STATUS', bookingId: booking.id },
    });
    return updatedTrip;
  }

  private async cancelBooking(bookingId: string, canceledBy: IntercityBookingCancelSource) {
    // Only moves a booking that is still cancelable, so a booking the car
    // already left with, or one canceled a moment ago, is never touched.
    const result = await this.prisma.intercityBooking.updateMany({
      where: { id: bookingId, status: { in: CANCELABLE_BOOKING_STATUSES } },
      data: {
        status: IntercityBookingStatus.CANCELED,
        canceledAt: new Date(),
        canceledBy,
      },
    });
    if (result.count === 0) {
      throw new BadRequestException('Бронь уже нельзя отменить: рейс выехал или бронь отменена');
    }

    const booking = await this.prisma.intercityBooking.findUniqueOrThrow({
      where: { id: bookingId },
      include: this.passengerBookingInclude(),
    });
    this.intercityGateway.emitBookingUpdated(booking);
    return booking;
  }

  /** Bookings of passengers who did not leave the trip themselves or get taken out. */
  private stillOnTripWhere() {
    return {
      OR: [
        { canceledBy: null },
        { canceledBy: IntercityBookingCancelSource.TRIP_CANCELED },
      ],
    } satisfies Prisma.IntercityBookingWhereInput;
  }

  private async requirePassenger(userId: string) {
    let passenger = await this.prisma.passengerProfile.findUnique({
      where: { userId },
    });
    if (!passenger) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      passenger = await this.prisma.passengerProfile.create({
        data: {
          userId,
          fullName: user.phone,
        },
      });
    }
    return passenger;
  }

  private async requireDriver(userId: string, requireIntercity = false) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
      include: { car: true, documents: true },
    });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }
    if (requireIntercity && !driver.supportsIntercity) {
      throw new ForbiddenException('Межгородний режим недоступен для этого водителя');
    }

    if (requireIntercity) {
      if (driver.status !== DriverStatus.APPROVED) {
        throw new ForbiddenException('Сначала получите одобрение профиля');
      }

      if (!driver.car || !driver.car.make || !driver.car.model || !driver.car.color || !driver.car.plateNumber) {
        throw new ForbiddenException('Для межгорода нужно заполнить автомобиль');
      }

      const approvedDocuments = driver.documents.filter((doc) => doc.approved);
      const hasDriverLicense = approvedDocuments.some((doc) => doc.type === DocumentType.DRIVER_LICENSE);
      const hasCarRegistration = approvedDocuments.some((doc) => doc.type === DocumentType.CAR_REGISTRATION);

      if (!hasDriverLicense) {
        throw new ForbiddenException('Для межгорода нужно загрузить водительское удостоверение');
      }

      if (!hasCarRegistration) {
        throw new ForbiddenException('Для межгорода нужно загрузить СТС');
      }
    }

    return driver;
  }

  private assertAllowedTripTransition(from: IntercityTripStatus, to: IntercityTripStatus) {
    const allowed: Record<IntercityTripStatus, IntercityTripStatus[]> = {
      [IntercityTripStatus.PLANNED]: [IntercityTripStatus.BOARDING, IntercityTripStatus.CANCELED],
      [IntercityTripStatus.BOARDING]: [IntercityTripStatus.IN_PROGRESS, IntercityTripStatus.CANCELED],
      [IntercityTripStatus.IN_PROGRESS]: [IntercityTripStatus.COMPLETED],
      [IntercityTripStatus.COMPLETED]: [],
      [IntercityTripStatus.CANCELED]: [],
    };
    if (!allowed[from].includes(to)) {
      throw new BadRequestException(`Cannot change trip status from ${from} to ${to}`);
    }
  }

  private publicTripInclude() {
    return {
      driver: {
        include: {
          user: true,
          car: true,
        },
      },
      bookings: {
        where: {
          status: {
            in: [
              IntercityBookingStatus.CONFIRMED,
              IntercityBookingStatus.BOARDING,
              IntercityBookingStatus.IN_PROGRESS,
            ],
          },
        },
        select: {
          seatsBooked: true,
        },
      },
    } satisfies Prisma.IntercityTripInclude;
  }

  private tripInviteInclude() {
    return {
      trip: {
        include: {
          driver: {
            include: {
              user: true,
              car: true,
            },
          },
        },
      },
      order: {
        include: {
          passenger: {
            include: {
              user: true,
            },
          },
        },
      },
    } satisfies Prisma.IntercityTripInviteInclude;
  }

  private getOrderWithInvitesInclude() {
    return {
      passenger: {
        include: {
          user: true,
        },
      },
      driver: {
        include: {
          user: true,
          car: true,
        },
      },
      statusHistory: {
        orderBy: { createdAt: 'asc' as const },
      },
      invites: {
        include: {
          trip: {
            include: {
              driver: {
                include: {
                  user: true,
                  car: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' as const },
      },
    } satisfies Prisma.IntercityOrderInclude;
  }

  private buildTripStatusNotificationBody(status: IntercityTripStatus) {
    switch (status) {
      case IntercityTripStatus.BOARDING:
        return 'Водитель начал посадку';
      case IntercityTripStatus.IN_PROGRESS:
        return 'Рейс выехал';
      case IntercityTripStatus.COMPLETED:
        return 'Рейс завершен';
      case IntercityTripStatus.CANCELED:
        return 'Рейс отменен';
      default:
        return 'Статус рейса обновлен';
    }
  }

  private driverTripInclude() {
    return {
      driver: {
        include: {
          user: true,
          car: true,
        },
      },
      bookings: {
        where: this.stillOnTripWhere(),
        include: {
          passenger: {
            include: {
              user: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' as const },
      },
      statusHistory: {
        orderBy: { createdAt: 'asc' as const },
      },
    } satisfies Prisma.IntercityTripInclude;
  }

  private passengerBookingInclude() {
    return {
      trip: {
        include: {
          driver: {
            include: {
              user: true,
              car: true,
            },
          },
          bookings: true,
          statusHistory: {
            orderBy: { createdAt: 'asc' as const },
          },
        },
      },
      passenger: {
        include: {
          user: true,
        },
      },
    } satisfies Prisma.IntercityBookingInclude;
  }
}
