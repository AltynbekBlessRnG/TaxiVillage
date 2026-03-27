import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { CourierOrderStatus, DriverStatus } from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service';
import { CourierOrdersGateway } from '../courier-orders/courier-orders.gateway';

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
  ) {}

  onModuleInit() {
    this.locationBatchTimer = setInterval(() => {
      this.flushLocationBatch();
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
    const now = new Date();
    const staleTime = 120000;

    for (const [userId, location] of this.locationCache.entries()) {
      if (now.getTime() - location.lastUpdate.getTime() > staleTime) {
        this.locationCache.delete(userId);
      }
    }

    for (const [userId, activeOrder] of this.activeOrderCache.entries()) {
      if (Date.now() - activeOrder.checkedAt > staleTime) {
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
      await this.prisma.$transaction([
        ...updates.map(({ userId, lat, lng }) =>
          this.prisma.courierProfile.update({
            where: { userId },
            data: { lat, lng },
          }),
        ),
        ...updates.map(({ userId, lat, lng }) =>
          this.prisma.driverProfile.updateMany({
            where: { userId },
            data: { lat, lng },
          }),
        ),
      ]);
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

    const courier = await this.prisma.courierProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!courier) {
      this.activeOrderCache.set(userId, { orderId: null, checkedAt: Date.now() });
      return null;
    }

    const currentOrder = await this.prisma.courierOrder.findFirst({
      where: {
        courierId: courier.id,
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

  private async requireCourierProfile(userId: string) {
    const courier = await this.prisma.courierProfile.findUnique({
      where: { userId },
    });
    if (!courier) {
      throw new NotFoundException('Профиль курьера не найден');
    }
    return courier;
  }

  async setOnlineStatus(userId: string, isOnline: boolean) {
    const courier = await this.requireCourierProfile(userId);
    if (isOnline && courier.status !== DriverStatus.APPROVED) {
      throw new BadRequestException('Курьер не одобрен администратором');
    }
    const updated = await this.prisma.courierProfile.update({
      where: { userId },
      data: { isOnline },
    });
    await this.prisma.driverProfile.updateMany({
      where: { userId },
      data: { isOnline },
    });
    return updated;
  }

  async updateLocation(userId: string, lat: number, lng: number) {
    this.locationCache.set(userId, { lat, lng, lastUpdate: new Date() });

    const activeOrderId = await this.getActiveOrder(userId);
    if (activeOrderId) {
      await this.prisma.$transaction([
        this.prisma.courierProfile.update({
          where: { userId },
          data: { lat, lng },
        }),
        this.prisma.driverProfile.updateMany({
          where: { userId },
          data: { lat, lng },
        }),
      ]);
      this.courierOrdersGateway.emitCourierMoved(activeOrderId, lat, lng);
    }

    return { success: true };
  }

  async getCurrentOrderForCourier(userId: string) {
    const courier = await this.requireCourierProfile(userId);

    const order = await this.prisma.courierOrder.findFirst({
      where: {
        courierId: courier.id,
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

    return order;
  }

  async getProfile(userId: string) {
    const courier = await this.prisma.courierProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!courier) {
      throw new NotFoundException('Courier profile not found');
    }
    return courier;
  }
}
