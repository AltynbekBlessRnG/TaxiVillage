import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FoodOrderStatus,
  PaymentMethod,
  Prisma,
  PromoDiscountType,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FoodOrdersGateway } from './food-orders.gateway';
import { NotificationsService } from '../notifications/notifications.service';

type OrderItemInput = { menuItemId: string; qty: number };
type OrderInput = {
  merchantId: string;
  deliveryAddress: string;
  deliveryLat?: number;
  deliveryLng?: number;
  comment?: string;
  items: OrderItemInput[];
  paymentMethod: PaymentMethod;
  promoCode?: string;
};

@Injectable()
export class FoodOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly foodOrdersGateway: FoodOrdersGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createOrderForPassenger(
    userId: string,
    data: OrderInput,
    rawIdempotencyKey?: string,
  ) {
    const idempotencyKey = rawIdempotencyKey?.trim() || undefined;
    if (idempotencyKey && idempotencyKey.length > 100) {
      throw new BadRequestException('Idempotency-Key is too long');
    }
    if (
      data.paymentMethod !== PaymentMethod.CASH &&
      data.paymentMethod !== PaymentMethod.KASPI_TRANSFER
    ) {
      throw new BadRequestException('Для заказа еды доступны только наличные или Kaspi');
    }

    if (idempotencyKey) {
      const existing = await this.prisma.foodOrder.findUnique({
        where: { idempotencyKey },
        include: this.getOrderInclude(),
      });
      if (existing) {
        return existing;
      }
    }

    const passenger = await this.ensurePassenger(userId);
    const priced = await this.priceOrder(data, passenger.id);
    const merchantPhone =
      priced.merchant.contactPhone ||
      priced.merchant.whatsAppPhone ||
      priced.merchant.user.phone;
    const total = Math.max(
      priced.subtotal - priced.discountAmount + Number(priced.merchant.deliveryFee),
      0,
    );

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        const created = await tx.foodOrder.create({
          data: {
            idempotencyKey,
            passengerId: passenger.id,
            merchantId: priced.merchant.id,
            deliveryAddress: data.deliveryAddress.trim(),
            deliveryLat: data.deliveryLat,
            deliveryLng: data.deliveryLng,
            comment: data.comment?.trim() || null,
            paymentMethod: data.paymentMethod,
            subtotal: new Prisma.Decimal(priced.subtotal),
            deliveryFee: priced.merchant.deliveryFee,
            discountAmount: new Prisma.Decimal(priced.discountAmount),
            commissionAmount: new Prisma.Decimal(0),
            driverPayout: priced.merchant.deliveryFee,
            totalPrice: new Prisma.Decimal(total),
            passengerPhoneSnapshot: passenger.user.phone,
            merchantPhoneSnapshot: merchantPhone,
            status: FoodOrderStatus.PLACED,
            items: {
              create: priced.cartItems.map(({ menuItem, qty }) => ({
                menuItemId: menuItem.id,
                name: menuItem.name,
                price: menuItem.price,
                qty,
              })),
            },
            statusHistory: {
              create: { status: FoodOrderStatus.PLACED },
            },
          },
        });

        if (priced.promo) {
          const reservedPromo = await tx.promoCode.updateMany({
            where: {
              id: priced.promo.id,
              isActive: true,
              ...(priced.promo.usageLimit != null
                ? { usageCount: { lt: priced.promo.usageLimit } }
                : {}),
            },
            data: { usageCount: { increment: 1 } },
          });
          if (reservedPromo.count !== 1) {
            throw new ConflictException('Лимит промокода уже исчерпан');
          }
          await tx.promoCodeRedemption.create({
            data: {
              promoCodeId: priced.promo.id,
              passengerId: passenger.id,
              foodOrderId: created.id,
              amount: new Prisma.Decimal(priced.discountAmount),
            },
          });
        }

        return created;
      });

      const fullOrder = await this.getOrderByIdForUser(
        userId,
        UserRole.PASSENGER,
        order.id,
      );
      this.foodOrdersGateway.emitOrderCreated(fullOrder);
      await this.notificationsService.sendPush(priced.merchant.user.pushToken, {
        title: 'Новый заказ еды',
        body: `Поступил новый заказ в ${priced.merchant.name}`,
        data: { type: 'FOOD_ORDER_CREATED', orderId: fullOrder.id },
      });
      return fullOrder;
    } catch (error) {
      if (idempotencyKey && this.isUniqueConstraintError(error)) {
        const existing = await this.prisma.foodOrder.findUnique({
          where: { idempotencyKey },
          include: this.getOrderInclude(),
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  async validatePromoCode(
    userId: string,
    data: { merchantId: string; promoCode: string; items: OrderItemInput[] },
  ) {
    const passenger = await this.ensurePassenger(userId);
    const priced = await this.priceOrder(
      {
        ...data,
        deliveryAddress: 'preview',
        paymentMethod: PaymentMethod.CASH,
      },
      passenger.id,
    );
    if (!priced.promo) {
      throw new BadRequestException('Промокод недействителен');
    }
    return {
      code: priced.promo.code,
      subtotal: priced.subtotal,
      discountAmount: priced.discountAmount,
      deliveryFee: Number(priced.merchant.deliveryFee),
      total:
        priced.subtotal -
        priced.discountAmount +
        Number(priced.merchant.deliveryFee),
    };
  }

  async getOrdersForUser(userId: string, role: UserRole) {
    const where = await this.getOrderWhereForUser(userId, role);
    return this.prisma.foodOrder.findMany({
      where,
      include: this.getOrderInclude(),
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getOrderByIdForUser(userId: string, role: UserRole, orderId: string) {
    const order = await this.prisma.foodOrder.findUnique({
      where: { id: orderId },
      include: this.getOrderInclude(),
    });
    if (!order || !this.canAccessOrder(userId, role, order)) {
      throw new NotFoundException('Food order not found');
    }
    return order;
  }

  async updateOrderStatusForMerchant(
    userId: string,
    orderId: string,
    status: FoodOrderStatus,
  ) {
    const merchant = await this.prisma.merchant.findUnique({ where: { userId } });
    if (!merchant) throw new NotFoundException('Merchant not found');

    const order = await this.prisma.foodOrder.findUnique({ where: { id: orderId } });
    if (!order || order.merchantId !== merchant.id) {
      throw new NotFoundException('Food order not found');
    }

    const allowed: Partial<Record<FoodOrderStatus, FoodOrderStatus[]>> = {
      [FoodOrderStatus.PLACED]: [FoodOrderStatus.ACCEPTED],
      [FoodOrderStatus.ACCEPTED]: [FoodOrderStatus.PREPARING],
      [FoodOrderStatus.PREPARING]: [FoodOrderStatus.SEARCHING_DRIVER],
      [FoodOrderStatus.READY_FOR_PICKUP]: [FoodOrderStatus.SEARCHING_DRIVER],
    };
    if (!allowed[order.status]?.includes(status)) {
      throw new BadRequestException(
        `Cannot change food order status from ${order.status} to ${status}`,
      );
    }

    const timestamps: Prisma.FoodOrderUpdateInput =
      status === FoodOrderStatus.ACCEPTED
        ? { acceptedAt: new Date() }
        : status === FoodOrderStatus.SEARCHING_DRIVER
          ? { searchingDriverAt: new Date() }
          : {};
    await this.setStatus(orderId, status, timestamps);
    const updated = await this.getOrderByIdForUser(userId, UserRole.MERCHANT, orderId);

    if (status === FoodOrderStatus.SEARCHING_DRIVER) {
      await this.notifyAvailableDrivers(updated);
    }
    await this.afterStatusUpdate(updated);
    return updated;
  }

  async cancelOrder(
    userId: string,
    role: UserRole,
    orderId: string,
    reason: string,
  ) {
    const order = await this.getOrderByIdForUser(userId, role, orderId);
    const passengerAllowed =
      role === UserRole.PASSENGER && order.status === FoodOrderStatus.PLACED;
    const merchantAllowed =
      role === UserRole.MERCHANT &&
      ([
        FoodOrderStatus.PLACED,
        FoodOrderStatus.ACCEPTED,
        FoodOrderStatus.PREPARING,
        FoodOrderStatus.READY_FOR_PICKUP,
        FoodOrderStatus.SEARCHING_DRIVER,
      ] as FoodOrderStatus[]).includes(order.status);
    const adminAllowed = role === UserRole.ADMIN;
    if (!passengerAllowed && !merchantAllowed && !adminAllowed) {
      throw new BadRequestException('Заказ уже нельзя отменить на этом этапе');
    }

    await this.setStatus(orderId, FoodOrderStatus.CANCELED, {
      cancellationReason: reason.trim(),
    });
    const updated = await this.getOrderByIdForUser(userId, role, orderId);
    await this.afterStatusUpdate(updated);
    return updated;
  }

  async repeatOrder(
    userId: string,
    orderId: string,
    idempotencyKey?: string,
  ) {
    const previous = await this.getOrderByIdForUser(
      userId,
      UserRole.PASSENGER,
      orderId,
    );
    return this.createOrderForPassenger(
      userId,
      {
        merchantId: previous.merchantId,
        deliveryAddress: previous.deliveryAddress,
        deliveryLat: previous.deliveryLat ?? undefined,
        deliveryLng: previous.deliveryLng ?? undefined,
        comment: previous.comment ?? undefined,
        paymentMethod:
          previous.paymentMethod === PaymentMethod.KASPI_TRANSFER
            ? PaymentMethod.KASPI_TRANSFER
            : PaymentMethod.CASH,
        items: previous.items.map((item) => ({
          menuItemId: item.menuItemId,
          qty: item.qty,
        })),
      },
      idempotencyKey,
    );
  }

  async getAvailableDeliveries(userId: string) {
    const driver = await this.requireDeliveryDriver(userId);
    const orders = await this.prisma.foodOrder.findMany({
      where: { status: FoodOrderStatus.SEARCHING_DRIVER, driverId: null },
      include: this.getOrderInclude(),
      orderBy: { searchingDriverAt: 'asc' },
      take: 30,
    });
    return orders.map((order) => ({
      ...order,
      distanceToMerchantKm:
        driver.lat != null &&
        driver.lng != null &&
        order.merchant.lat != null &&
        order.merchant.lng != null
          ? this.distanceKm(
              driver.lat,
              driver.lng,
              order.merchant.lat,
              order.merchant.lng,
            )
          : null,
    }));
  }

  async getCurrentDelivery(userId: string) {
    const driver = await this.requireDeliveryDriver(userId);
    return this.prisma.foodOrder.findFirst({
      where: {
        driverId: driver.id,
        status: {
          in: [
            FoodOrderStatus.DRIVER_ASSIGNED,
            FoodOrderStatus.AT_MERCHANT,
            FoodOrderStatus.ON_DELIVERY,
          ],
        },
      },
      include: this.getOrderInclude(),
      orderBy: { driverAssignedAt: 'desc' },
    });
  }

  async claimDelivery(userId: string, orderId: string) {
    const driver = await this.requireDeliveryDriver(userId);
    const current = await this.getCurrentDelivery(userId);
    if (current) {
      throw new ConflictException('Сначала завершите текущую доставку');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.foodOrder.updateMany({
        where: {
          id: orderId,
          status: FoodOrderStatus.SEARCHING_DRIVER,
          driverId: null,
        },
        data: {
          driverId: driver.id,
          status: FoodOrderStatus.DRIVER_ASSIGNED,
          driverAssignedAt: new Date(),
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('Эту доставку уже принял другой водитель');
      }
      await tx.foodOrderStatusHistory.create({
        data: { foodOrderId: orderId, status: FoodOrderStatus.DRIVER_ASSIGNED },
      });
      return tx.foodOrder.findUniqueOrThrow({
        where: { id: orderId },
        include: this.getOrderInclude(),
      });
    });

    await this.afterStatusUpdate(result);
    return result;
  }

  async updateDeliveryStatus(
    userId: string,
    orderId: string,
    status: FoodOrderStatus,
  ) {
    const driver = await this.requireDeliveryDriver(userId);
    const order = await this.prisma.foodOrder.findUnique({ where: { id: orderId } });
    if (!order || order.driverId !== driver.id) {
      throw new NotFoundException('Food delivery not found');
    }

    const allowed: Partial<Record<FoodOrderStatus, FoodOrderStatus[]>> = {
      [FoodOrderStatus.DRIVER_ASSIGNED]: [FoodOrderStatus.AT_MERCHANT],
      [FoodOrderStatus.AT_MERCHANT]: [FoodOrderStatus.ON_DELIVERY],
      [FoodOrderStatus.ON_DELIVERY]: [FoodOrderStatus.DELIVERED],
    };
    if (!allowed[order.status]?.includes(status)) {
      throw new BadRequestException(
        `Cannot change food delivery status from ${order.status} to ${status}`,
      );
    }

    if (status === FoodOrderStatus.DELIVERED) {
      await this.completeDelivery(orderId);
    } else {
      await this.setStatus(orderId, status, {
        ...(status === FoodOrderStatus.AT_MERCHANT
          ? { arrivedAtMerchantAt: new Date() }
          : {}),
        ...(status === FoodOrderStatus.ON_DELIVERY ? { pickedUpAt: new Date() } : {}),
      });
    }

    const updated = await this.getOrderByIdForUser(userId, UserRole.DRIVER, orderId);
    await this.afterStatusUpdate(updated);
    return updated;
  }

  async assignDriverByAdmin(orderId: string, driverId: string) {
    const driver = await this.prisma.driverProfile.findUnique({ where: { id: driverId } });
    if (!driver || driver.status !== 'APPROVED') {
      throw new BadRequestException('Driver is not approved');
    }
    const order = await this.prisma.foodOrder.findUnique({ where: { id: orderId } });
    if (
      !order ||
      !([
        FoodOrderStatus.SEARCHING_DRIVER,
        FoodOrderStatus.DRIVER_ASSIGNED,
      ] as FoodOrderStatus[]).includes(order.status)
    ) {
      throw new BadRequestException('Order is not assignable');
    }
    await this.setStatus(orderId, FoodOrderStatus.DRIVER_ASSIGNED, {
      driver: { connect: { id: driverId } },
      driverAssignedAt: new Date(),
    });
    const updated = await this.prisma.foodOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: this.getOrderInclude(),
    });
    await this.afterStatusUpdate(updated);
    return updated;
  }

  private async completeDelivery(orderId: string) {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.foodOrder.findUniqueOrThrow({
        where: { id: orderId },
        include: { merchant: true },
      });
      if (order.status !== FoodOrderStatus.ON_DELIVERY) {
        throw new ConflictException('Order has already been completed');
      }
      const shouldChargeCommission =
        order.merchant.completedOrderCount >= order.merchant.freeOrderLimit;
      const commission = shouldChargeCommission
        ? Number(order.subtotal) * (order.merchant.commissionPercent / 100)
        : 0;

      const completed = await tx.foodOrder.updateMany({
        where: { id: orderId, status: FoodOrderStatus.ON_DELIVERY },
        data: {
          status: FoodOrderStatus.DELIVERED,
          deliveredAt: new Date(),
          commissionAmount: new Prisma.Decimal(commission),
        },
      });
      if (completed.count !== 1) {
        throw new ConflictException('Order has already been completed');
      }
      await tx.foodOrderStatusHistory.create({
        data: { foodOrderId: orderId, status: FoodOrderStatus.DELIVERED },
      });
      await tx.merchant.update({
        where: { id: order.merchantId },
        data: {
          completedOrderCount: { increment: 1 },
          ...(commission > 0
            ? { commissionDebt: { increment: new Prisma.Decimal(commission) } }
            : {}),
        },
      });
      if (commission > 0) {
        await tx.merchantSettlement.create({
          data: {
            merchantId: order.merchantId,
            foodOrderId: order.id,
            type: 'COMMISSION_CHARGE',
            amount: new Prisma.Decimal(commission),
            note: `Комиссия ${order.merchant.commissionPercent}%`,
          },
        });
      }
    });
  }

  private async priceOrder(data: OrderInput, passengerId: string) {
    if (!data.items.length) throw new BadRequestException('Корзина пуста');
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: data.merchantId },
      include: {
        user: true,
        menuCategories: { include: { items: true } },
      },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    if (
      merchant.verificationStatus !== 'VERIFIED' ||
      !merchant.isOpen ||
      !this.isOpenNow(merchant.openingHours)
    ) {
      throw new BadRequestException('Заведение сейчас не принимает заказы');
    }
    if (Number(merchant.commissionDebt) >= Number(merchant.commissionDebtLimit)) {
      throw new BadRequestException(
        'Заведение временно не принимает заказы. Идёт сверка расчётов.',
      );
    }

    if (
      data.deliveryLat != null &&
      data.deliveryLng != null &&
      merchant.lat != null &&
      merchant.lng != null &&
      this.distanceKm(
        merchant.lat,
        merchant.lng,
        data.deliveryLat,
        data.deliveryLng,
      ) > merchant.deliveryRadiusKm
    ) {
      throw new BadRequestException('Адрес находится вне зоны доставки');
    }

    const menuItems = merchant.menuCategories.flatMap((category) => category.items);
    const cartItems = data.items.map((input) => {
      const menuItem = menuItems.find((item) => item.id === input.menuItemId);
      if (!menuItem || !menuItem.isAvailable) {
        throw new BadRequestException('Одно из блюд недоступно');
      }
      return { menuItem, qty: input.qty };
    });
    const subtotal = cartItems.reduce(
      (sum, item) => sum + Number(item.menuItem.price) * item.qty,
      0,
    );
    if (subtotal < Number(merchant.minOrder)) {
      throw new BadRequestException(
        `Минимальная сумма заказа — ${Number(merchant.minOrder)} ₸`,
      );
    }

    const promo = data.promoCode
      ? await this.findApplicablePromo(
          data.promoCode,
          merchant.id,
          passengerId,
          subtotal,
        )
      : null;
    if (data.promoCode && !promo) {
      throw new BadRequestException('Промокод недействителен для этого заказа');
    }
    const discountAmount = promo ? this.calculateDiscount(promo, subtotal) : 0;
    return { merchant, cartItems, subtotal, promo, discountAmount };
  }

  private async findApplicablePromo(
    rawCode: string,
    merchantId: string,
    passengerId: string,
    subtotal: number,
  ) {
    const now = new Date();
    const promo = await this.prisma.promoCode.findUnique({
      where: { code: rawCode.trim().toUpperCase() },
    });
    if (
      !promo ||
      !promo.isActive ||
      (promo.merchantId && promo.merchantId !== merchantId) ||
      Number(promo.minSubtotal) > subtotal ||
      (promo.startsAt && promo.startsAt > now) ||
      (promo.expiresAt && promo.expiresAt < now) ||
      (promo.usageLimit != null && promo.usageCount >= promo.usageLimit)
    ) {
      return null;
    }
    const personalUses = await this.prisma.promoCodeRedemption.count({
      where: { promoCodeId: promo.id, passengerId },
    });
    return personalUses < promo.perUserLimit ? promo : null;
  }

  private calculateDiscount(
    promo: {
      discountType: PromoDiscountType;
      discountValue: Prisma.Decimal;
      maxDiscount: Prisma.Decimal | null;
    },
    subtotal: number,
  ) {
    const raw =
      promo.discountType === PromoDiscountType.PERCENT
        ? subtotal * (Number(promo.discountValue) / 100)
        : Number(promo.discountValue);
    return Math.min(raw, promo.maxDiscount ? Number(promo.maxDiscount) : raw, subtotal);
  }

  private async ensurePassenger(userId: string) {
    const existing = await this.prisma.passengerProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (existing) return existing;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.passengerProfile.create({
      data: { userId, fullName: user.phone },
      include: { user: true },
    });
  }

  private async requireDeliveryDriver(userId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
      include: { user: true, car: true },
    });
    if (
      !driver ||
      driver.status !== 'APPROVED' ||
      (!driver.supportsCourier && !driver.supportsTaxi)
    ) {
      throw new ForbiddenException('Водитель не допущен к доставке');
    }
    return driver;
  }

  private async setStatus(
    orderId: string,
    status: FoodOrderStatus,
    data: Prisma.FoodOrderUpdateInput = {},
  ) {
    await this.prisma.$transaction([
      this.prisma.foodOrder.update({
        where: { id: orderId },
        data: { ...data, status },
      }),
      this.prisma.foodOrderStatusHistory.create({
        data: { foodOrderId: orderId, status },
      }),
    ]);
  }

  private async notifyAvailableDrivers(order: any) {
    const drivers = await this.prisma.driverProfile.findMany({
      where: {
        status: 'APPROVED',
        isOnline: true,
        OR: [{ supportsCourier: true }, { supportsTaxi: true }],
      },
      include: { user: true },
    });
    this.foodOrdersGateway.emitDeliveryAvailable(
      order,
      drivers.map((driver) => driver.userId),
    );
    await Promise.all(
      drivers.map((driver) =>
        this.notificationsService.sendPush(driver.user.pushToken, {
          title: 'Новая доставка еды',
          body: `${order.merchant.name} → ${order.deliveryAddress}`,
          data: { type: 'FOOD_DELIVERY_AVAILABLE', orderId: order.id },
        }),
      ),
    );
  }

  private async afterStatusUpdate(order: any) {
    this.foodOrdersGateway.emitOrderUpdated(order);
    const message = this.statusMessage(order.status);
    if (message) {
      await this.notificationsService.sendPush(order.passenger?.user?.pushToken, {
        ...message,
        data: {
          type: 'FOOD_ORDER_STATUS',
          orderId: order.id,
          status: order.status,
        },
      });
    }
    if (
      order.driver?.user?.pushToken &&
      order.status === FoodOrderStatus.DRIVER_ASSIGNED
    ) {
      await this.notificationsService.sendPush(order.driver.user.pushToken, {
        title: 'Доставка назначена',
        body: `${order.merchant.name} → ${order.deliveryAddress}`,
        data: { type: 'FOOD_DELIVERY_ASSIGNED', orderId: order.id },
      });
    }
  }

  private statusMessage(status: FoodOrderStatus) {
    const messages: Partial<
      Record<FoodOrderStatus, { title: string; body: string }>
    > = {
      ACCEPTED: {
        title: 'Заказ принят',
        body: 'Заведение подтвердило заказ.',
      },
      PREPARING: { title: 'Заказ готовят', body: 'Кухня начала приготовление.' },
      SEARCHING_DRIVER: {
        title: 'Ищем водителя',
        body: 'Заказ готовится, ищем водителя для доставки.',
      },
      DRIVER_ASSIGNED: {
        title: 'Водитель назначен',
        body: 'Водитель направляется в заведение.',
      },
      AT_MERCHANT: {
        title: 'Водитель в заведении',
        body: 'Водитель забирает ваш заказ.',
      },
      ON_DELIVERY: { title: 'Заказ в пути', body: 'Водитель везёт ваш заказ.' },
      DELIVERED: { title: 'Заказ доставлен', body: 'Приятного аппетита!' },
      CANCELED: { title: 'Заказ отменён', body: 'Откройте заказ, чтобы увидеть причину.' },
    };
    return messages[status];
  }

  private async getOrderWhereForUser(userId: string, role: UserRole) {
    if (role === UserRole.ADMIN) return {};
    if (role === UserRole.PASSENGER) {
      const passenger = await this.prisma.passengerProfile.findUnique({
        where: { userId },
      });
      return { passengerId: passenger?.id || '__missing__' };
    }
    if (role === UserRole.MERCHANT) {
      const merchant = await this.prisma.merchant.findUnique({ where: { userId } });
      return { merchantId: merchant?.id || '__missing__' };
    }
    const driver = await this.prisma.driverProfile.findUnique({ where: { userId } });
    return { driverId: driver?.id || '__missing__' };
  }

  private canAccessOrder(userId: string, role: UserRole, order: any) {
    return (
      role === UserRole.ADMIN ||
      order.passenger?.userId === userId ||
      order.merchant?.userId === userId ||
      order.driver?.userId === userId
    );
  }

  private getOrderInclude() {
    return {
      passenger: { include: { user: true } },
      merchant: { include: { user: true } },
      driver: { include: { user: true, car: true } },
      items: true,
      promoRedemption: { include: { promoCode: true } },
      statusHistory: { orderBy: { createdAt: 'asc' as const } },
    } satisfies Prisma.FoodOrderInclude;
  }

  private isOpenNow(openingHours: Prisma.JsonValue | null) {
    if (!openingHours || typeof openingHours !== 'object' || Array.isArray(openingHours)) {
      return true;
    }
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Qyzylorda',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const dayKey = parts
      .find((part) => part.type === 'weekday')
      ?.value.toLowerCase()
      .slice(0, 3);
    const windows = (openingHours as Record<string, unknown>)[dayKey || ''];
    if (!Array.isArray(windows)) return true;
    const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
    const minutes = hour * 60 + minute;
    return windows.some((window) => {
      if (!window || typeof window !== 'object') return false;
      const { open, close } = window as { open?: string; close?: string };
      const parse = (value?: string) => {
        const [hours, mins] = String(value || '').split(':').map(Number);
        return Number.isFinite(hours) && Number.isFinite(mins)
          ? hours * 60 + mins
          : null;
      };
      const start = parse(open);
      const end = parse(close);
      if (start == null || end == null) return false;
      return end >= start
        ? minutes >= start && minutes <= end
        : minutes >= start || minutes <= end;
    });
  }

  private distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
    );
  }
}
