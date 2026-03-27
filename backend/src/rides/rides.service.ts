import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { Prisma, RideStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RidesGateway } from './rides.gateway';
import { NotificationsService } from '../notifications/notifications.service';

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

type RideRecord = Awaited<ReturnType<RidesService['loadRideRecord']>>;

interface OfferState {
  driverId: string;
  attempt: number;
  excludedDriverIds: Set<string>;
  timeout: NodeJS.Timeout;
}

@Injectable()
export class RidesService implements OnModuleDestroy {
  private readonly logger = new Logger(RidesService.name);
  private readonly rideOfferStates = new Map<string, OfferState>();
  private readonly MAX_ATTEMPTS = 3;
  private readonly OFFER_TIMEOUT = 30000;
  private readonly MIN_BALANCE = -500;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ridesGateway: RidesGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleDestroy() {
    for (const offer of this.rideOfferStates.values()) {
      clearTimeout(offer.timeout);
    }
    this.rideOfferStates.clear();
  }

  async createRideForPassenger(
    userId: string,
    data: {
      fromAddress: string;
      toAddress: string;
      fromLat?: number;
      fromLng?: number;
      toLat?: number;
      toLng?: number;
      comment?: string;
      stops?: Array<{ address: string; lat: number; lng: number }>;
      paymentMethod?: 'CARD' | 'CASH';
      estimatedPrice?: number;
    },
  ) {
    const passengerProfile = await this.prisma.passengerProfile.findUnique({
      where: { userId },
    });
    if (!passengerProfile) {
      throw new NotFoundException('Passenger profile not found');
    }

    const activeTariff = await this.prisma.tariff.findFirst({
      where: { isActive: true },
    });
    const tariffId = activeTariff
      ? activeTariff.id
      : await this.ensureDefaultTariffId();
    const tariff = await this.prisma.tariff.findUnique({
      where: { id: tariffId },
    });
    if (!tariff) {
      throw new NotFoundException('Tariff not found');
    }

    const fromLat = data.fromLat ?? 0;
    const fromLng = data.fromLng ?? 0;
    const toLat = data.toLat ?? 0;
    const toLng = data.toLng ?? 0;
    const hasFrom = fromLat !== 0 || fromLng !== 0;
    const hasTo = toLat !== 0 || toLng !== 0;

    const coordinates: Array<{ lat: number; lng: number }> = [];
    if (hasFrom) {
      coordinates.push({ lat: fromLat, lng: fromLng });
    }
    for (const stop of data.stops ?? []) {
      coordinates.push({ lat: stop.lat, lng: stop.lng });
    }
    if (hasTo) {
      coordinates.push({ lat: toLat, lng: toLng });
    }

    let distanceKm = 0;
    for (let i = 0; i < coordinates.length - 1; i += 1) {
      distanceKm += haversineDistance(
        coordinates[i].lat,
        coordinates[i].lng,
        coordinates[i + 1].lat,
        coordinates[i + 1].lng,
      );
    }
    if (distanceKm === 0 && hasFrom && !hasTo) {
      distanceKm = 3;
    }
    if (distanceKm === 0) {
      distanceKm = 5;
    }

    const estimatedMinutes = Math.ceil(distanceKm / 0.5);
    const baseFare = Number(tariff.baseFare);
    const pricePerKm = Number(tariff.pricePerKm);
    const pricePerMinute = tariff.pricePerMinute
      ? Number(tariff.pricePerMinute)
      : 0;
    const suggestedPrice = new Prisma.Decimal(
      baseFare + distanceKm * pricePerKm + estimatedMinutes * pricePerMinute,
    );

    // In this product the passenger can suggest a custom price.
    const negotiatedPrice =
      data.estimatedPrice && data.estimatedPrice > 0
        ? new Prisma.Decimal(data.estimatedPrice)
        : suggestedPrice;

    const ride = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ride.create({
        data: {
          passengerId: passengerProfile.id,
          tariffId,
          status: RideStatus.SEARCHING_DRIVER,
          fromAddress: data.fromAddress,
          toAddress: data.toAddress,
          fromLat,
          fromLng,
          toLat,
          toLng,
          comment: data.comment || null,
          paymentMethod: data.paymentMethod || 'CARD',
          estimatedPrice: negotiatedPrice,
        },
      });

      for (const stop of data.stops ?? []) {
        await tx.rideStop.create({
          data: {
            rideId: created.id,
            address: stop.address,
            lat: stop.lat,
            lng: stop.lng,
          },
        });
      }

      await tx.rideStatusHistory.create({
        data: {
          rideId: created.id,
          status: RideStatus.SEARCHING_DRIVER,
        },
      });

      return created;
    });

    const rideWithUsers = await this.loadRideRecord(ride.id);
    const ridePayload = {
      ...rideWithUsers,
      hasRoute: hasFrom && hasTo,
    };

    this.ridesGateway.emitRideCreated(ridePayload as any);
    await this.findAndOfferRideToDriver(ridePayload);

    return ridePayload;
  }

  async getRidesForUser(userId: string, role: UserRole) {
    if (role === UserRole.PASSENGER) {
      const passenger = await this.prisma.passengerProfile.findUnique({
        where: { userId },
      });
      if (!passenger) {
        return [];
      }
      return this.prisma.ride.findMany({
        where: { passengerId: passenger.id },
        include: this.getRideInclude(),
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    }

    if (role === UserRole.DRIVER) {
      const driver = await this.prisma.driverProfile.findUnique({
        where: { userId },
      });
      if (!driver) {
        return [];
      }
      return this.prisma.ride.findMany({
        where: { driverId: driver.id },
        include: this.getRideInclude(),
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    }

    if (role === UserRole.ADMIN) {
      return this.prisma.ride.findMany({
        include: this.getRideInclude(),
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    }

    return [];
  }

  async getRideByIdForUser(userId: string, role: UserRole, rideId: string) {
    const ride = await this.loadRideRecord(rideId);
    await this.assertRideAccess(ride, userId, role);
    return ride;
  }

  async getRideById(rideId: string) {
    return this.loadRideRecord(rideId);
  }

  async cancelRideByPassenger(userId: string, rideId: string) {
    const passenger = await this.prisma.passengerProfile.findUnique({
      where: { userId },
    });
    if (!passenger) {
      throw new NotFoundException('Passenger profile not found');
    }

    const ride = await this.loadRideRecord(rideId);
    if (ride.passengerId !== passenger.id) {
      throw new NotFoundException('Ride not found');
    }
    if (
      ride.status !== RideStatus.SEARCHING_DRIVER &&
      ride.status !== RideStatus.DRIVER_ASSIGNED &&
      ride.status !== RideStatus.ON_THE_WAY &&
      ride.status !== RideStatus.DRIVER_ARRIVED
    ) {
      throw new BadRequestException('Cannot cancel ride in current status');
    }

    const clearedOfferState = this.clearOfferState(rideId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.ride.update({
        where: { id: rideId },
        data: { status: RideStatus.CANCELED },
      });

      await tx.rideStatusHistory.create({
        data: { rideId, status: RideStatus.CANCELED },
      });

      return u;
    });

    const rideWithUsers = await this.loadRideRecord(rideId);
    this.ridesGateway.emitRideUpdated(rideWithUsers as any);
    await this.notifyOfferedDriverAboutCancellation(clearedOfferState, rideWithUsers);
    await this.sendPassengerRideNotification(rideWithUsers);
    return updated;
  }

  async updateRideStatus(
    userId: string,
    role: UserRole,
    rideId: string,
    status: RideStatus,
  ) {
    return this.transitionRideStatus(userId, role, rideId, status);
  }

  async completeRide(userId: string, rideId: string, finalPrice?: number) {
    return this.transitionRideStatus(
      userId,
      UserRole.DRIVER,
      rideId,
      RideStatus.COMPLETED,
      finalPrice,
    );
  }

  async acceptRide(driverUserId: string, rideId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId: driverUserId },
    });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }
    if (Number(driver.balance) < this.MIN_BALANCE) {
      throw new BadRequestException(
        `Баланс слишком низкий (${driver.balance} ₸). Пополните баланс чтобы принимать заказы. Минимум: ${this.MIN_BALANCE} ₸`,
      );
    }

    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.ride.updateMany({
        where: {
          id: rideId,
          status: RideStatus.SEARCHING_DRIVER,
          driverId: null,
        },
        data: {
          driverId: driver.id,
          status: RideStatus.ON_THE_WAY,
        },
      });

      if (result.count === 0) {
        throw new ConflictException('Ride is no longer available');
      }

      await tx.rideStatusHistory.create({
        data: {
          rideId,
          status: RideStatus.ON_THE_WAY,
        },
      });

      return tx.ride.findUnique({ where: { id: rideId } });
    });

    this.clearOfferState(rideId);

    const rideWithUsers = await this.loadRideRecord(rideId);
    this.ridesGateway.emitRideUpdated(rideWithUsers as any);
    await this.sendPassengerRideNotification(rideWithUsers);

    return updated;
  }

  async rejectRide(driverUserId: string, rideId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId: driverUserId },
    });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) {
      throw new NotFoundException('Ride not found');
    }
    if (ride.status !== RideStatus.SEARCHING_DRIVER) {
      throw new ConflictException('Ride is no longer awaiting a driver');
    }

    const offerState = this.rideOfferStates.get(rideId);
    if (!offerState || offerState.driverId !== driver.id) {
      throw new ForbiddenException('Ride offer is not assigned to this driver');
    }

    const nextExcluded = new Set(offerState.excludedDriverIds);
    nextExcluded.add(driver.id);
    const nextAttempt = offerState.attempt + 1;

    this.clearOfferState(rideId);

    const rideWithUsers = await this.loadRideRecord(rideId);
    await this.findAndOfferRideToDriver(rideWithUsers, nextAttempt, nextExcluded);

    return { success: true };
  }

  async rateRide(passengerUserId: string, rideId: string, stars: number) {
    if (stars < 1 || stars > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    const passenger = await this.prisma.passengerProfile.findUnique({
      where: { userId: passengerUserId },
    });
    if (!passenger) {
      throw new NotFoundException('Passenger profile not found');
    }

    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: { driver: true },
    });
    if (!ride || ride.passengerId !== passenger.id) {
      throw new NotFoundException('Ride not found');
    }
    if (ride.status !== RideStatus.COMPLETED) {
      throw new BadRequestException('Can only rate completed rides');
    }
    if (ride.driverRating !== null) {
      throw new ConflictException('Ride already rated');
    }
    if (!ride.driverId) {
      throw new NotFoundException('No driver assigned to this ride');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.ride.update({
        where: { id: rideId },
        data: { driverRating: stars },
      });

      const driverRides = await tx.ride.findMany({
        where: {
          driverId: ride.driverId,
          driverRating: { not: null },
        },
        select: { driverRating: true },
      });

      const totalRatings = driverRides.length;
      const sumRatings = driverRides.reduce(
        (sum, r) => sum + (r.driverRating ?? 0),
        0,
      );

      await tx.driverProfile.update({
        where: { id: ride.driverId! },
        data: { rating: totalRatings > 0 ? sumRatings / totalRatings : 5.0 },
      });
    });

    return { success: true };
  }

  private async transitionRideStatus(
    userId: string,
    role: UserRole,
    rideId: string,
    status: RideStatus,
    finalPriceOverride?: number,
  ) {
    const ride = await this.loadRideRecord(rideId);

    if (role !== UserRole.DRIVER) {
      throw new ForbiddenException('Only drivers can update ride status');
    }

    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!driverProfile || ride.driverId !== driverProfile.id) {
      throw new NotFoundException('Ride not assigned to this driver');
    }

    if (
      ride.status === RideStatus.COMPLETED ||
      ride.status === RideStatus.CANCELED
    ) {
      throw new ConflictException('Ride is already finished');
    }

    this.assertAllowedTransition(ride.status, status);

    const now = new Date();
    const data: Prisma.RideUpdateInput = {
      status,
      startedAt:
        status === RideStatus.IN_PROGRESS && !ride.startedAt
          ? now
          : ride.startedAt,
      finishedAt: status === RideStatus.COMPLETED ? now : ride.finishedAt,
    };

    if (status === RideStatus.COMPLETED) {
      if (ride.commissionAmount || ride.finalPrice) {
        throw new ConflictException('Ride is already completed');
      }

      const finalPriceValue =
        finalPriceOverride && finalPriceOverride > 0
          ? finalPriceOverride
          : Number(ride.estimatedPrice ?? 0);
      const finalPrice = new Prisma.Decimal(finalPriceValue);
      const commissionPercent = ride.tariff?.systemCommissionPercent ?? 10;
      const commissionAmount = new Prisma.Decimal(
        (finalPriceValue * commissionPercent) / 100,
      );

      data.finalPrice = finalPrice;
      data.commissionAmount = commissionAmount;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const lockedRide = await tx.ride.findUnique({
        where: { id: rideId },
        include: { tariff: true },
      });

      if (!lockedRide) {
        throw new NotFoundException('Ride not found');
      }
      if (
        lockedRide.status === RideStatus.COMPLETED ||
        lockedRide.status === RideStatus.CANCELED
      ) {
        throw new ConflictException('Ride is already finished');
      }

      const rideUpdate = await tx.ride.update({
        where: { id: rideId },
        data,
      });

      if (status === RideStatus.COMPLETED && data.commissionAmount) {
        await tx.driverProfile.update({
          where: { id: driverProfile.id },
          data: {
            balance: { decrement: data.commissionAmount as Prisma.Decimal },
            lastRideFinishedAt: now,
          },
        });
      }

      await tx.rideStatusHistory.create({
        data: {
          rideId,
          status,
        },
      });

      return rideUpdate;
    });

    await this.clearOfferState(rideId);

    const rideWithUsers = await this.loadRideRecord(rideId);
    this.ridesGateway.emitRideUpdated(rideWithUsers as any);
    await this.sendPassengerRideNotification(rideWithUsers);

    return updated;
  }

  private assertAllowedTransition(from: RideStatus, to: RideStatus) {
    const allowedTransitions: Record<RideStatus, RideStatus[]> = {
      [RideStatus.SEARCHING_DRIVER]: [
        RideStatus.ON_THE_WAY,
        RideStatus.CANCELED,
      ],
      [RideStatus.DRIVER_ASSIGNED]: [
        RideStatus.ON_THE_WAY,
        RideStatus.CANCELED,
      ],
      [RideStatus.ON_THE_WAY]: [RideStatus.DRIVER_ARRIVED, RideStatus.CANCELED],
      [RideStatus.DRIVER_ARRIVED]: [RideStatus.IN_PROGRESS, RideStatus.CANCELED],
      [RideStatus.IN_PROGRESS]: [RideStatus.COMPLETED],
      [RideStatus.COMPLETED]: [],
      [RideStatus.CANCELED]: [],
    };

    if (!allowedTransitions[from].includes(to)) {
      throw new BadRequestException(
        `Cannot change ride status from ${from} to ${to}`,
      );
    }
  }

  private async findAndOfferRideToDriver(
    rideWithUsers: any,
    attempt = 1,
    excludedDriverIds: Set<string> = new Set(),
  ) {
    const freshRide = await this.prisma.ride.findUnique({
      where: { id: rideWithUsers.id },
      select: { status: true, driverId: true },
    });
    if (
      !freshRide ||
      freshRide.status !== RideStatus.SEARCHING_DRIVER ||
      freshRide.driverId
    ) {
      this.clearOfferState(rideWithUsers.id);
      return;
    }

    if (attempt > this.MAX_ATTEMPTS) {
      this.logger.warn(
        `Ride ${rideWithUsers.id} - No driver found after ${this.MAX_ATTEMPTS} attempts`,
      );
      await this.cancelRideIfSearching(rideWithUsers.id);
      return;
    }

    const drivers = await this.findEligibleDrivers(
      rideWithUsers.fromLat,
      rideWithUsers.fromLng,
      excludedDriverIds,
    );

    if (drivers.length === 0) {
      this.logger.warn(
        `Ride ${rideWithUsers.id} - No eligible drivers available (attempt ${attempt})`,
      );
      this.scheduleOfferRetry(
        rideWithUsers,
        null,
        attempt + 1,
        new Set(excludedDriverIds),
      );
      return;
    }

    const driversWithDistance = drivers.map((driver) => ({
      driver,
      distance:
        rideWithUsers.fromLat === 0 && rideWithUsers.fromLng === 0
          ? 0
          : haversineDistance(
              rideWithUsers.fromLat,
              rideWithUsers.fromLng,
              driver.lat!,
              driver.lng!,
            ),
    }));

    const nearbyDrivers = driversWithDistance
      .filter((item) => item.distance <= 3)
      .sort((a, b) => {
        const timeA = a.driver.lastRideFinishedAt?.getTime() ?? 0;
        const timeB = b.driver.lastRideFinishedAt?.getTime() ?? 0;
        return timeA - timeB;
      });

    const selectedDriver =
      nearbyDrivers[0] ??
      driversWithDistance.sort((a, b) => a.distance - b.distance)[0];

    const nextExcluded = new Set(excludedDriverIds);
    nextExcluded.add(selectedDriver.driver.id);

    this.logger.log(
      `Ride ${rideWithUsers.id} - Offering to driver ${selectedDriver.driver.userId} (attempt ${attempt}/${this.MAX_ATTEMPTS})`,
    );

    this.ridesGateway.emitRideOffer(selectedDriver.driver.userId, rideWithUsers);
    this.scheduleOfferRetry(
      rideWithUsers,
      selectedDriver.driver.id,
      attempt + 1,
      nextExcluded,
    );
  }

  private scheduleOfferRetry(
    rideWithUsers: any,
    driverId: string | null,
    attempt: number,
    excludedDriverIds: Set<string>,
  ) {
    const timeout = setTimeout(async () => {
      const activeOffer = this.rideOfferStates.get(rideWithUsers.id);
      if (activeOffer && activeOffer.timeout !== timeout) {
        return;
      }

      this.rideOfferStates.delete(rideWithUsers.id);
      await this.findAndOfferRideToDriver(
        rideWithUsers,
        attempt,
        new Set(excludedDriverIds),
      );
    }, this.OFFER_TIMEOUT);

    if (driverId) {
      this.clearOfferState(rideWithUsers.id);
      this.rideOfferStates.set(rideWithUsers.id, {
        driverId,
        attempt,
        excludedDriverIds,
        timeout,
      });
      return;
    }

    const existing = this.rideOfferStates.get(rideWithUsers.id);
    if (existing) {
      clearTimeout(existing.timeout);
    }
    this.rideOfferStates.set(rideWithUsers.id, {
      driverId: '',
      attempt,
      excludedDriverIds,
      timeout,
    });
  }

  private async cancelRideIfSearching(rideId: string) {
    try {
      const result = await this.prisma.ride.updateMany({
        where: { id: rideId, status: RideStatus.SEARCHING_DRIVER },
        data: { status: RideStatus.CANCELED },
      });

      const clearedOfferState = this.clearOfferState(rideId);

      if (result.count > 0) {
        await this.prisma.rideStatusHistory.create({
          data: { rideId, status: RideStatus.CANCELED },
        });
      }

      const rideWithUsers = await this.loadRideRecord(rideId);
      this.ridesGateway.emitRideUpdated(rideWithUsers as any);
      await this.notifyOfferedDriverAboutCancellation(clearedOfferState, rideWithUsers);
      await this.sendPassengerRideNotification(rideWithUsers);
    } catch (error) {
      this.logger.error(`Failed to cancel ride ${rideId}:`, error as any);
    }
  }

  private clearOfferState(rideId: string) {
    const offerState = this.rideOfferStates.get(rideId);
    if (offerState) {
      clearTimeout(offerState.timeout);
      this.rideOfferStates.delete(rideId);
    }
    return offerState;
  }

  private async notifyOfferedDriverAboutCancellation(
    offerState: OfferState | undefined,
    ride: RideRecord,
  ) {
    if (!offerState?.driverId) {
      return;
    }

    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: offerState.driverId },
      select: { userId: true },
    });

    if (!driver?.userId) {
      return;
    }

    this.ridesGateway.emitRideUpdatedToUser(driver.userId, ride as any);
  }

  private async ensureDefaultTariffId(): Promise<string> {
    const existing = await this.prisma.tariff.findFirst();
    if (existing) {
      return existing.id;
    }
    const created = await this.prisma.tariff.create({
      data: {
        name: 'Стандарт',
        baseFare: 100,
        pricePerKm: 15,
      },
    });
    return created.id;
  }

  private async assertRideAccess(
    ride: RideRecord,
    userId: string,
    role: UserRole,
  ) {
    if (role === UserRole.ADMIN) {
      return;
    }

    if (role === UserRole.PASSENGER) {
      const passenger = await this.prisma.passengerProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!passenger || passenger.id !== ride.passengerId) {
        throw new NotFoundException('Ride not found');
      }
      return;
    }

    if (role === UserRole.DRIVER) {
      const driver = await this.prisma.driverProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!driver || ride.driverId !== driver.id) {
        throw new NotFoundException('Ride not found');
      }
      return;
    }

    throw new ForbiddenException('Access denied');
  }

  private async loadRideRecord(rideId: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: this.getRideInclude(),
    });
    if (!ride) {
      throw new NotFoundException('Ride not found');
    }
    return ride;
  }

  private getRideInclude() {
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
      tariff: true,
      stops: {
        orderBy: { createdAt: 'asc' as const },
      },
    } satisfies Prisma.RideInclude;
  }

  private async sendPassengerRideNotification(ride: RideRecord) {
    const pushToken = ride.passenger?.user?.pushToken;

    if (
      ride.status === RideStatus.DRIVER_ASSIGNED ||
      ride.status === RideStatus.ON_THE_WAY
    ) {
      await this.notificationsService.sendPush(pushToken, {
        title: 'Водитель выехал к вам',
        body: 'Водитель принял заказ и уже едет к точке подачи.',
        data: { rideId: ride.id, status: ride.status },
      });
    }

    if (ride.status === RideStatus.DRIVER_ARRIVED) {
      await this.notificationsService.sendPush(pushToken, {
        title: 'Водитель приехал',
        body: 'Водитель ожидает вас в точке подачи.',
        data: { rideId: ride.id, status: ride.status },
      });
    }

    if (ride.status === RideStatus.CANCELED) {
      await this.notificationsService.sendPush(pushToken, {
        title: 'Поездка отменена',
        body: 'Заказ был отменен. Попробуйте снова.',
        data: { rideId: ride.id, status: ride.status },
      });
    }
  }

  private async findEligibleDrivers(
    fromLat: number,
    fromLng: number,
    excludedDriverIds: Set<string>,
  ) {
    const hasCoordinates = fromLat !== 0 || fromLng !== 0;
    const delta = 0.3;

    const baseWhere: Prisma.DriverProfileWhereInput = {
      status: 'APPROVED',
      isOnline: true,
      supportsTaxi: true,
      driverMode: 'TAXI',
      balance: { gte: new Prisma.Decimal(this.MIN_BALANCE) },
      lat: { not: null },
      lng: { not: null },
      id: { notIn: Array.from(excludedDriverIds) },
    };

    const localizedWhere = hasCoordinates
      ? {
          ...baseWhere,
          lat: {
            not: null,
            gte: fromLat - delta,
            lte: fromLat + delta,
          },
          lng: {
            not: null,
            gte: fromLng - delta,
            lte: fromLng + delta,
          },
        }
      : baseWhere;

    let drivers = await this.prisma.driverProfile.findMany({
      where: localizedWhere,
      include: { user: true },
    });

    if (drivers.length === 0 && hasCoordinates) {
      drivers = await this.prisma.driverProfile.findMany({
        where: baseWhere,
        include: { user: true },
      });
    }

    return drivers;
  }
}
