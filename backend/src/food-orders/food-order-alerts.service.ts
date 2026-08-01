import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { FoodOrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FoodOrderAlertsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FoodOrderAlertsService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.checkStalledOrders().catch((error) =>
        this.logger.error('Failed to check stalled food orders', error),
      );
    }, 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async checkStalledOrders() {
    const now = Date.now();
    const stalled = await this.prisma.foodOrder.findMany({
      where: {
        OR: [
          {
            status: FoodOrderStatus.PLACED,
            createdAt: { lt: new Date(now - 5 * 60_000) },
            merchantAlertedAt: null,
          },
          {
            status: FoodOrderStatus.SEARCHING_DRIVER,
            searchingDriverAt: { lt: new Date(now - 10 * 60_000) },
            driverAlertedAt: null,
          },
        ],
      },
      include: { merchant: true },
      take: 50,
    });
    if (!stalled.length) return;

    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', pushToken: { not: null }, isDeleted: false },
      select: { pushToken: true },
    });

    for (const order of stalled) {
      const isMerchantTimeout = order.status === FoodOrderStatus.PLACED;
      const claimed = await this.prisma.foodOrder.updateMany({
        where: {
          id: order.id,
          status: order.status,
          ...(isMerchantTimeout
            ? { merchantAlertedAt: null }
            : { driverAlertedAt: null }),
        },
        data: isMerchantTimeout
          ? { merchantAlertedAt: new Date() }
          : { driverAlertedAt: new Date() },
      });
      if (claimed.count !== 1) continue;

      await Promise.all(
        admins.map((admin) =>
          this.notificationsService.sendPush(admin.pushToken, {
            title: isMerchantTimeout
              ? 'Заведение не приняло заказ'
              : 'Не найден водитель',
            body: `${order.merchant.name}: заказ ${order.id.slice(-6)}`,
            data: {
              type: 'FOOD_ORDER_STALLED',
              orderId: order.id,
              problem: isMerchantTimeout
                ? 'MERCHANT_TIMEOUT'
                : 'DRIVER_TIMEOUT',
            },
          }),
        ),
      );
    }
  }
}
