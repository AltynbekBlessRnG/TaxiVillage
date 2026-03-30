import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { CourierOrderStatus, DriverMode, DriverStatus } from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service';
import { CourierOrdersGateway } from '../courier-orders/courier-orders.gateway';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class CouriersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CouriersService.name);
  private readonly ACTIVE_ORDER_CACHE_TTL = 3000;
  private readonly BATCH_INTERVAL = 30000;
  private readonly CACHE_CLEANUP_INTERVAL = 60000;

  private locationCache = new Map<string, { lat: number; lng: number; lastUpdate: Date }>();
  private activeOrderCache = new Map<string, { orderId: string | null; checkedAt: number }>();
  private locationBatchTimer?: NodeJS.Timeout;
  private cacheCleanupTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly courierOrdersGateway: CourierOrdersGateway,
    private readonly redisService: RedisService,
  ) {}

  onModuleInit() {
    this.locationBatchTimer = setInterval(() => {
      void this.flushLocationBatch();
    }, this.BATCH_INTERVAL);

    this.cacheCleanupTimer = setInterval(() => {
      this.cleanupOldCacheEntries();
    }, this.CACHE_CLEANUP_INTERVAL);
  }

  onModuleDestroy() {
    if (this.locationBatchTimer) {
      clearInterval(this.locationBatchTimer);
      void this.flushLocationBatch();
    }

    if (this.cacheCleanupTimer) {
      clearInterval(this.cacheCleanupTimer);
    }
  }

  private cleanupOldCacheEntries() {
    const now = Date.now();
    const staleTime = 120000;

    for (const [userId, location] of this.locationCache.entries()) {
      if (now - location.lastUpdate.getTime() > staleTime) {
        this.locationCache.delete(userId);
      }
    }

    for (const [userId, activeOrder] of this.activeOrderCache.entries()) {
      if (now - activeOrder.checkedAt > staleTime) {
        this.activeOrderCache.delete(userId);
      }
    }
  }

  private async flushLocationBatch() {
    if (this.locationCache.size === 0) {
      return;
    }

    const updates = Array.from(this.locationCache.entries()).map(([userId, location]) => ({
      userId,
      lat: location.lat,
      lng: location.lng,
    }));

    try {
      await this.prisma.$transaction(
        updates.map(({ userId, lat, lng }) =>
          this.prisma.driverProfile.update({
            where: { userId },
            data: { lat, lng },
          }),
        ),
      );
      this.logger.log(`Batch updated ${updates.length} courier locations`);
    } catch (error) {
      this.logger.error('Failed to batch update courier locations:', error);
    }

    this.locationCache.clear();
  }

  private async getActiveOrder(userId: string) {
    const cached = this.activeOrderCache.get(userId);
    if (cached && Date.now() - cached.checkedAt < this.ACTIVE_ORDER_CACHE_TTL) {
      return cached.orderId;
    }

    const assignment = await this.redisService.getActiveAssignment('courier-order', userId);
    if (assignment?.entityId) {
      this.activeOrderCache.set(userId, {
        orderId: assignment.entityId,
        checkedAt: Date.now(),
      });
      return assignment.entityId;
    }

    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
      select: { id: true, supportsCourier: true },
    });

    if (!driver?.supportsCourier) {
      this.activeOrderCache.set(userId, { orderId: null, checkedAt: Date.now() });
      return null;
    }

    const currentOrder = await this.prisma.courierOrder.findFirst({
      where: {
        courierId: driver.id,
        status: {
          in: [
            CourierOrderStatus.TO_PICKUP,
            CourierOrderStatus.COURIER_ARRIVED,
            CourierOrderStatus.TO_RECIPIENT,
            CourierOrderStatus.PICKED_UP,
            CourierOrderStatus.DELIVERING,
          ],
        },
      },
      select: { id: true },
    });

    const orderId = currentOrder?.id ?? null;
    this.activeOrderCache.set(userId, { orderId, checkedAt: Date.now() });
    return orderId;
  }

  private async requireCourierDriverProfile(userId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
      include: { user: true, car: true, documents: true },
    });
    if (!driver) {
      throw new NotFoundException('Профиль водителя не найден');
    }
    if (!driver.supportsCourier) {
      throw new ForbiddenException('Курьерский режим недоступен для этого профиля');
    }
    return driver;
  }

  async setOnlineStatus(userId: string, isOnline: boolean) {
    const driver = await this.requireCourierDriverProfile(userId);
    if (driver.driverMode !== DriverMode.COURIER) {
      throw new BadRequestException('Сначала переключитесь в курьерский режим');
    }
    if (isOnline && driver.status !== DriverStatus.APPROVED) {
      throw new BadRequestException('Курьер не одобрен администратором');
    }
    return this.prisma.driverProfile.update({
      where: { userId },
      data: { isOnline },
    });
  }

  async updateLocation(userId: string, lat: number, lng: number) {
    this.locationCache.set(userId, { lat, lng, lastUpdate: new Date() });
    await this.redisService.cacheLocation('courier', userId, lat, lng);

    const activeOrderId = await this.getActiveOrder(userId);
    if (activeOrderId) {
      await this.prisma.driverProfile.update({
        where: { userId },
        data: { lat, lng },
      });
      this.courierOrdersGateway.emitCourierMoved(activeOrderId, lat, lng);
    }

    return { success: true };
  }

  async getCurrentOrderForCourier(userId: string) {
    const driver = await this.requireCourierDriverProfile(userId);
    const activeStatuses: CourierOrderStatus[] = [
      CourierOrderStatus.TO_PICKUP,
      CourierOrderStatus.COURIER_ARRIVED,
      CourierOrderStatus.TO_RECIPIENT,
      CourierOrderStatus.PICKED_UP,
      CourierOrderStatus.DELIVERING,
    ];

    const assignment = await this.redisService.getActiveAssignment('courier-order', userId);
    if (assignment?.entityId) {
      const orderFromRedis = await this.prisma.courierOrder.findUnique({
        where: { id: assignment.entityId },
        include: {
          passenger: {
            include: {
              user: true,
            },
          },
        },
      });

      if (
        orderFromRedis &&
        orderFromRedis.courierId === driver.id &&
        activeStatuses.includes(orderFromRedis.status)
      ) {
        this.activeOrderCache.set(userId, {
          orderId: orderFromRedis.id,
          checkedAt: Date.now(),
        });
        return orderFromRedis;
      }

      await this.redisService.clearActiveAssignment('courier-order', userId);
    }

    const order = await this.prisma.courierOrder.findFirst({
      where: {
        courierId: driver.id,
        status: {
          in: [
            CourierOrderStatus.TO_PICKUP,
            CourierOrderStatus.COURIER_ARRIVED,
            CourierOrderStatus.TO_RECIPIENT,
            CourierOrderStatus.PICKED_UP,
            CourierOrderStatus.DELIVERING,
          ],
        },
      },
      include: {
        passenger: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    this.activeOrderCache.set(userId, {
      orderId: order?.id ?? null,
      checkedAt: Date.now(),
    });

    if (order?.id) {
      await this.redisService.setActiveAssignment('courier-order', userId, order.id, order.status);
    } else {
      await this.redisService.clearActiveAssignment('courier-order', userId);
    }

    return order;
  }

  async getProfile(userId: string) {
    return this.requireCourierDriverProfile(userId);
  }
}
