import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  CourierOrderStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CourierOrdersGateway } from './courier-orders.gateway';

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

type CourierOrderRecord = Awaited<ReturnType<CourierOrdersService['loadOrderRecord']>>;

interface OfferState {
  courierId: string;
  attempt: number;
  excludedCourierIds: Set<string>;
  timeout: NodeJS.Timeout;
}

@Injectable()
export class CourierOrdersService implements OnModuleDestroy {
  private readonly logger = new Logger(CourierOrdersService.name);
  private readonly orderOfferStates = new Map<string, OfferState>();
  private readonly MAX_ATTEMPTS = 3;
  private readonly OFFER_TIMEOUT = 30000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly courierOrdersGateway: CourierOrdersGateway,
  ) {}

  onModuleDestroy() {
    for (const offer of this.orderOfferStates.values()) {
      clearTimeout(offer.timeout);
    }
    this.orderOfferStates.clear();
  }

  async createOrderForPassenger(
    userId: string,
    data: {
      pickupAddress: string;
      dropoffAddress: string;
      pickupLat?: number;
      pickupLng?: number;
      dropoffLat?: number;
      dropoffLng?: number;
      itemDescription: string;
      packageWeight?: string;
      packageSize?: string;
      comment?: string;
      estimatedPrice?: number;
      paymentMethod?: 'CARD' | 'CASH';
    },
  ) {
    const passenger = await this.prisma.passengerProfile.findUnique({
      where: { userId },
    });
    if (!passenger) {
      throw new NotFoundException('Passenger profile not found');
    }

    const activeOrder = await this.prisma.courierOrder.findFirst({
      where: {
        passengerId: passenger.id,
        status: {
          in: [
            CourierOrderStatus.SEARCHING_COURIER,
            CourierOrderStatus.TO_PICKUP,
            CourierOrderStatus.PICKED_UP,
            CourierOrderStatus.DELIVERING,
          ],
        },
      },
    });
    if (activeOrder) {
      throw new ConflictException('У вас уже есть активный курьерский заказ');
    }

    const pickupLat = data.pickupLat ?? 0;
    const pickupLng = data.pickupLng ?? 0;
    const dropoffLat = data.dropoffLat ?? 0;
    const dropoffLng = data.dropoffLng ?? 0;
    const hasRoute =
      (pickupLat !== 0 || pickupLng !== 0) && (dropoffLat !== 0 || dropoffLng !== 0);
    const distanceKm = hasRoute
      ? haversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng)
      : 5;
    const suggestedPrice = Math.round(1200 + distanceKm * 220);

    await this.prisma.$transaction(async (tx) => {
      const created = await tx.courierOrder.create({
        data: {
          passengerId: passenger.id,
          status: CourierOrderStatus.SEARCHING_COURIER,
          pickupAddress: data.pickupAddress,
          pickupLat,
          pickupLng,
          dropoffAddress: data.dropoffAddress,
          dropoffLat,
          dropoffLng,
          itemDescription: data.itemDescription,
          packageWeight: data.packageWeight || null,
          packageSize: data.packageSize || null,
          comment: data.comment || null,
          paymentMethod: data.paymentMethod || 'CARD',
          estimatedPrice: new Prisma.Decimal(data.estimatedPrice || suggestedPrice),
        },
      });

      await tx.courierOrderStatusHistory.create({
        data: {
          courierOrderId: created.id,
          status: CourierOrderStatus.SEARCHING_COURIER,
        },
      });
    });

    const createdOrder = await this.prisma.courierOrder.findFirst({
      where: { passengerId: passenger.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!createdOrder) {
      throw new NotFoundException('Courier order not found after creation');
    }

    const orderRecord = await this.loadOrderRecord(createdOrder.id);
    this.courierOrdersGateway.emitOrderCreated(orderRecord as any);
    await this.findAndOfferOrderToCourier(orderRecord);
    return orderRecord;
  }

  async getOrdersForUser(userId: string, role: UserRole) {
    if (role === UserRole.PASSENGER) {
      const passenger = await this.prisma.passengerProfile.findUnique({
        where: { userId },
      });
      if (!passenger) {
        return [];
      }
      return this.prisma.courierOrder.findMany({
        where: { passengerId: passenger.id },
        include: this.getOrderInclude(),
        orderBy: { createdAt: 'desc' },
      });
    }

    if (role === UserRole.COURIER) {
      const courier = await this.prisma.courierProfile.findUnique({
        where: { userId },
      });
      if (!courier) {
        return [];
      }
      return this.prisma.courierOrder.findMany({
        where: { courierId: courier.id },
        include: this.getOrderInclude(),
        orderBy: { createdAt: 'desc' },
      });
    }

    if (role === UserRole.ADMIN) {
      return this.prisma.courierOrder.findMany({
        include: this.getOrderInclude(),
        orderBy: { createdAt: 'desc' },
      });
    }

    return [];
  }

  async getOrderByIdForUser(userId: string, role: UserRole, orderId: string) {
    const order = await this.loadOrderRecord(orderId);
    await this.assertOrderAccess(order, userId, role);
    return order;
  }

  async getAvailableOrdersForCourier(userId: string) {
    const courier = await this.prisma.courierProfile.findUnique({
      where: { userId },
    });
    if (!courier) {
      throw new NotFoundException('Courier profile not found');
    }

    const orders = await this.prisma.courierOrder.findMany({
      where: { status: CourierOrderStatus.SEARCHING_COURIER, courierId: null },
      include: this.getOrderInclude(),
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return orders
      .map((order) => ({
        ...order,
        distanceKm:
          courier.lat != null && courier.lng != null
            ? haversineDistance(courier.lat, courier.lng, order.pickupLat, order.pickupLng)
            : null,
      }))
      .sort((a, b) => (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER));
  }

  async cancelOrderByPassenger(userId: string, orderId: string) {
    const passenger = await this.prisma.passengerProfile.findUnique({
      where: { userId },
    });
    if (!passenger) {
      throw new NotFoundException('Passenger profile not found');
    }

    const order = await this.loadOrderRecord(orderId);
    if (order.passengerId !== passenger.id) {
      throw new NotFoundException('Courier order not found');
    }
    if (
      order.status !== CourierOrderStatus.SEARCHING_COURIER &&
      order.status !== CourierOrderStatus.TO_PICKUP
    ) {
      throw new BadRequestException('Cannot cancel courier order in current status');
    }

    const clearedOffer = this.clearOfferState(orderId);

    await this.prisma.$transaction(async (tx) => {
      await tx.courierOrder.update({
        where: { id: orderId },
        data: { status: CourierOrderStatus.CANCELED },
      });
      await tx.courierOrderStatusHistory.create({
        data: { courierOrderId: orderId, status: CourierOrderStatus.CANCELED },
      });
    });

    const updated = await this.loadOrderRecord(orderId);
    this.courierOrdersGateway.emitOrderUpdated(updated as any);
    await this.notifyOfferedCourierAboutCancellation(clearedOffer, updated);
    await this.sendPassengerOrderNotification(updated);
    return updated;
  }

  async acceptOrder(courierUserId: string, orderId: string) {
    const courier = await this.prisma.courierProfile.findUnique({
      where: { userId: courierUserId },
    });
    if (!courier) {
      throw new NotFoundException('Courier profile not found');
    }

    await this.prisma.$transaction(async (tx) => {
      const result = await tx.courierOrder.updateMany({
        where: {
          id: orderId,
          status: CourierOrderStatus.SEARCHING_COURIER,
          courierId: null,
        },
        data: {
          courierId: courier.id,
          status: CourierOrderStatus.TO_PICKUP,
        },
      });

      if (result.count === 0) {
        throw new ConflictException('Courier order is no longer available');
      }

      await tx.courierOrderStatusHistory.create({
        data: {
          courierOrderId: orderId,
          status: CourierOrderStatus.TO_PICKUP,
        },
      });
    });

    this.clearOfferState(orderId);

    const updated = await this.loadOrderRecord(orderId);
    this.courierOrdersGateway.emitOrderUpdated(updated as any);
    await this.sendPassengerOrderNotification(updated);
    return updated;
  }

  async rejectOrder(courierUserId: string, orderId: string) {
    const courier = await this.prisma.courierProfile.findUnique({
      where: { userId: courierUserId },
    });
    if (!courier) {
      throw new NotFoundException('Courier profile not found');
    }

    const order = await this.prisma.courierOrder.findUnique({
      where: { id: orderId },
    });
    if (!order || order.status !== CourierOrderStatus.SEARCHING_COURIER) {
      throw new ConflictException('Courier order is no longer awaiting a courier');
    }

    const offerState = this.orderOfferStates.get(orderId);
    if (!offerState || offerState.courierId !== courier.id) {
      throw new ForbiddenException('Courier offer is not assigned to this courier');
    }

    const nextExcluded = new Set(offerState.excludedCourierIds);
    nextExcluded.add(courier.id);
    const nextAttempt = offerState.attempt + 1;

    this.clearOfferState(orderId);

    const orderRecord = await this.loadOrderRecord(orderId);
    await this.findAndOfferOrderToCourier(orderRecord, nextAttempt, nextExcluded);
    return { success: true };
  }

  async updateOrderStatus(courierUserId: string, orderId: string, status: CourierOrderStatus) {
    const courier = await this.prisma.courierProfile.findUnique({
      where: { userId: courierUserId },
    });
    if (!courier) {
      throw new NotFoundException('Courier profile not found');
    }

    const order = await this.loadOrderRecord(orderId);
    if (order.courierId !== courier.id) {
      throw new NotFoundException('Courier order not assigned to this courier');
    }

    this.assertAllowedTransition(order.status, status);

    const now = new Date();
    const data: Prisma.CourierOrderUpdateInput = {
      status,
      pickedUpAt:
        status === CourierOrderStatus.PICKED_UP && !order.pickedUpAt
          ? now
          : order.pickedUpAt,
      deliveredAt:
        status === CourierOrderStatus.DELIVERED && !order.deliveredAt
          ? now
          : order.deliveredAt,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.courierOrder.update({
        where: { id: orderId },
        data,
      });
      await tx.courierOrderStatusHistory.create({
        data: { courierOrderId: orderId, status },
      });

      if (status === CourierOrderStatus.DELIVERED) {
        await tx.courierProfile.update({
          where: { id: courier.id },
          data: { lastOrderFinishedAt: now },
        });
      }
    });

    const updated = await this.loadOrderRecord(orderId);
    this.courierOrdersGateway.emitOrderUpdated(updated as any);
    await this.sendPassengerOrderNotification(updated);
    return updated;
  }

  private assertAllowedTransition(from: CourierOrderStatus, to: CourierOrderStatus) {
    const allowedTransitions: Record<CourierOrderStatus, CourierOrderStatus[]> = {
      [CourierOrderStatus.SEARCHING_COURIER]: [
        CourierOrderStatus.TO_PICKUP,
        CourierOrderStatus.CANCELED,
      ],
      [CourierOrderStatus.TO_PICKUP]: [
        CourierOrderStatus.PICKED_UP,
        CourierOrderStatus.CANCELED,
      ],
      [CourierOrderStatus.PICKED_UP]: [CourierOrderStatus.DELIVERING],
      [CourierOrderStatus.DELIVERING]: [CourierOrderStatus.DELIVERED],
      [CourierOrderStatus.DELIVERED]: [],
      [CourierOrderStatus.CANCELED]: [],
    };

    if (!allowedTransitions[from].includes(to)) {
      throw new BadRequestException(`Cannot change courier order status from ${from} to ${to}`);
    }
  }

  private async findAndOfferOrderToCourier(
    order: CourierOrderRecord,
    attempt = 1,
    excludedCourierIds: Set<string> = new Set(),
  ) {
    const freshOrder = await this.prisma.courierOrder.findUnique({
      where: { id: order.id },
      select: { status: true, courierId: true },
    });
    if (
      !freshOrder ||
      freshOrder.status !== CourierOrderStatus.SEARCHING_COURIER ||
      freshOrder.courierId
    ) {
      this.clearOfferState(order.id);
      return;
    }

    if (attempt > this.MAX_ATTEMPTS) {
      this.logger.warn(`Courier order ${order.id} - No courier found after ${this.MAX_ATTEMPTS} attempts`);
      await this.cancelOrderIfSearching(order.id);
      return;
    }

    const couriers = await this.findEligibleCouriers(
      order.pickupLat,
      order.pickupLng,
      excludedCourierIds,
    );

    if (couriers.length === 0) {
      this.scheduleOfferRetry(order, null, attempt + 1, new Set(excludedCourierIds));
      return;
    }

    const ranked = couriers
      .map((courier) => ({
        courier,
        distance:
          order.pickupLat === 0 && order.pickupLng === 0
            ? 0
            : haversineDistance(order.pickupLat, order.pickupLng, courier.lat!, courier.lng!),
      }))
      .sort((a, b) => a.distance - b.distance);

    const selected = ranked[0];
    const nextExcluded = new Set(excludedCourierIds);
    nextExcluded.add(selected.courier.id);

    this.courierOrdersGateway.emitCourierOffer(selected.courier.userId, order as any);
    this.scheduleOfferRetry(order, selected.courier.id, attempt + 1, nextExcluded);
  }

  private scheduleOfferRetry(
    order: CourierOrderRecord,
    courierId: string | null,
    attempt: number,
    excludedCourierIds: Set<string>,
  ) {
    const timeout = setTimeout(async () => {
      const activeOffer = this.orderOfferStates.get(order.id);
      if (activeOffer && activeOffer.timeout !== timeout) {
        return;
      }
      this.orderOfferStates.delete(order.id);
      await this.findAndOfferOrderToCourier(order, attempt, new Set(excludedCourierIds));
    }, this.OFFER_TIMEOUT);

    const existing = this.orderOfferStates.get(order.id);
    if (existing) {
      clearTimeout(existing.timeout);
    }

    this.orderOfferStates.set(order.id, {
      courierId: courierId ?? '',
      attempt,
      excludedCourierIds,
      timeout,
    });
  }

  private async cancelOrderIfSearching(orderId: string) {
    const result = await this.prisma.courierOrder.updateMany({
      where: { id: orderId, status: CourierOrderStatus.SEARCHING_COURIER },
      data: { status: CourierOrderStatus.CANCELED },
    });

    const clearedOffer = this.clearOfferState(orderId);
    if (result.count > 0) {
      await this.prisma.courierOrderStatusHistory.create({
        data: {
          courierOrderId: orderId,
          status: CourierOrderStatus.CANCELED,
        },
      });
      const updated = await this.loadOrderRecord(orderId);
      this.courierOrdersGateway.emitOrderUpdated(updated as any);
      await this.notifyOfferedCourierAboutCancellation(clearedOffer, updated);
      await this.sendPassengerOrderNotification(updated);
    }
  }

  private clearOfferState(orderId: string) {
    const state = this.orderOfferStates.get(orderId);
    if (state) {
      clearTimeout(state.timeout);
      this.orderOfferStates.delete(orderId);
    }
    return state;
  }

  private async notifyOfferedCourierAboutCancellation(
    offerState: OfferState | undefined,
    order: CourierOrderRecord,
  ) {
    if (!offerState?.courierId) {
      return;
    }

    const courier = await this.prisma.courierProfile.findUnique({
      where: { id: offerState.courierId },
      select: { userId: true },
    });
    if (!courier?.userId) {
      return;
    }

    this.courierOrdersGateway.emitOrderUpdatedToUser(courier.userId, order as any);
  }

  private async assertOrderAccess(order: CourierOrderRecord, userId: string, role: UserRole) {
    if (role === UserRole.ADMIN) {
      return;
    }

    if (role === UserRole.PASSENGER) {
      const passenger = await this.prisma.passengerProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!passenger || passenger.id !== order.passengerId) {
        throw new NotFoundException('Courier order not found');
      }
      return;
    }

    if (role === UserRole.COURIER) {
      const courier = await this.prisma.courierProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      const activeOffer = this.orderOfferStates.get(order.id);
      const isOfferedCourier = activeOffer?.courierId === courier?.id;
      if (!courier || (order.courierId !== courier.id && !isOfferedCourier)) {
        throw new NotFoundException('Courier order not found');
      }
      return;
    }

    throw new ForbiddenException('Access denied');
  }

  private async loadOrderRecord(orderId: string) {
    const order = await this.prisma.courierOrder.findUnique({
      where: { id: orderId },
      include: this.getOrderInclude(),
    });
    if (!order) {
      throw new NotFoundException('Courier order not found');
    }
    return order;
  }

  private getOrderInclude() {
    return {
      passenger: {
        include: {
          user: true,
        },
      },
      courier: {
        include: {
          user: true,
        },
      },
      statusHistory: {
        orderBy: { createdAt: 'asc' as const },
      },
    } satisfies Prisma.CourierOrderInclude;
  }

  private async sendPassengerOrderNotification(order: CourierOrderRecord) {
    const pushToken = order.passenger?.user?.pushToken;

    if (order.status === CourierOrderStatus.TO_PICKUP) {
      await this.notificationsService.sendPush(pushToken, {
        title: 'Курьер выехал',
        body: 'Курьер принял заказ и едет к точке забора.',
        data: { courierOrderId: order.id, status: order.status },
      });
    }

    if (order.status === CourierOrderStatus.PICKED_UP) {
      await this.notificationsService.sendPush(pushToken, {
        title: 'Посылка у курьера',
        body: 'Курьер забрал посылку и готовится к доставке.',
        data: { courierOrderId: order.id, status: order.status },
      });
    }

    if (order.status === CourierOrderStatus.DELIVERED) {
      await this.notificationsService.sendPush(pushToken, {
        title: 'Доставка завершена',
        body: 'Курьерский заказ успешно доставлен.',
        data: { courierOrderId: order.id, status: order.status },
      });
    }

    if (order.status === CourierOrderStatus.CANCELED) {
      await this.notificationsService.sendPush(pushToken, {
        title: 'Курьерский заказ отменен',
        body: 'Не удалось найти курьера. Попробуйте снова.',
        data: { courierOrderId: order.id, status: order.status },
      });
    }
  }

  private async findEligibleCouriers(
    pickupLat: number,
    pickupLng: number,
    excludedCourierIds: Set<string>,
  ) {
    const hasCoordinates = pickupLat !== 0 || pickupLng !== 0;
    const delta = 0.3;
    const baseWhere: Prisma.CourierProfileWhereInput = {
      status: 'APPROVED',
      isOnline: true,
      lat: { not: null },
      lng: { not: null },
      id: { notIn: Array.from(excludedCourierIds) },
    };

    const localizedWhere = hasCoordinates
      ? {
          ...baseWhere,
          lat: { not: null, gte: pickupLat - delta, lte: pickupLat + delta },
          lng: { not: null, gte: pickupLng - delta, lte: pickupLng + delta },
        }
      : baseWhere;

    let couriers = await this.prisma.courierProfile.findMany({
      where: localizedWhere,
      include: { user: true },
    });

    if (couriers.length === 0 && hasCoordinates) {
      couriers = await this.prisma.courierProfile.findMany({
        where: baseWhere,
        include: { user: true },
      });
    }

    return couriers;
  }
}
