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
  IntercityBookingStatus,
  IntercityBookingType,
  IntercityTripStatus,
  Prisma,
} from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service';
import { IntercityGateway } from './intercity.gateway';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class IntercityTripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intercityGateway: IntercityGateway,
    private readonly redisService: RedisService,
  ) {}

  async listPublicTrips(filters: {
    fromCity?: string;
    toCity?: string;
    minPrice?: number;
    maxPrice?: number;
    seatsRequired?: number;
    baggageRequired?: boolean;
    womenOnly?: boolean;
    noAnimals?: boolean;
  }) {
    const trips = await this.prisma.intercityTrip.findMany({
      where: {
        status: IntercityTripStatus.PLANNED,
        fromCity: filters.fromCity ? { contains: filters.fromCity, mode: 'insensitive' } : undefined,
        toCity: filters.toCity ? { contains: filters.toCity, mode: 'insensitive' } : undefined,
        departureAt: { gte: new Date() },
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

    return trips
      .map((trip) => {
      const seatsUsed = trip.bookings.reduce((sum, booking) => sum + booking.seatsBooked, 0);
      return {
        ...trip,
        seatsRemaining: Math.max(trip.seatCapacity - seatsUsed, 0),
        bookings: undefined,
      };
      })
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
    return trip;
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
    const trip = await this.prisma.intercityTrip.findUnique({
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

    const existingBooking = await this.prisma.intercityBooking.findFirst({
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

    const usedSeats = trip.bookings.reduce((sum, booking) => sum + booking.seatsBooked, 0);
    const remainingSeats = Math.max(trip.seatCapacity - usedSeats, 0);

    let seatsBooked = data.seatsBooked;
    if (data.bookingType === IntercityBookingType.FULL_CABIN) {
      if (usedSeats > 0) {
        throw new BadRequestException('Полный салон можно забронировать только если мест еще никто не занял');
      }
      seatsBooked = trip.seatCapacity;
    }

    if (seatsBooked < 1 || seatsBooked > remainingSeats) {
      throw new BadRequestException('Недостаточно свободных мест на рейсе');
    }

    const booking = await this.prisma.intercityBooking.create({
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

    this.intercityGateway.emitBookingUpdated(booking);
    return booking;
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
          data: { status: IntercityBookingStatus.CANCELED },
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

    const affectedBookings = await this.prisma.intercityBooking.findMany({
      where: { tripId },
      include: this.passengerBookingInclude(),
    });
    affectedBookings.forEach((booking) => this.intercityGateway.emitBookingUpdated(booking));

    return updatedTrip;
  }

  private async requirePassenger(userId: string) {
    const passenger = await this.prisma.passengerProfile.findUnique({
      where: { userId },
    });
    if (!passenger) {
      throw new NotFoundException('Passenger profile not found');
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

  private driverTripInclude() {
    return {
      driver: {
        include: {
          user: true,
          car: true,
        },
      },
      bookings: {
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
