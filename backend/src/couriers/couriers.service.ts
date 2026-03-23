import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourierOrderStatus, DriverStatus } from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service';
import { CourierOrdersGateway } from '../courier-orders/courier-orders.gateway';

@Injectable()
export class CouriersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courierOrdersGateway: CourierOrdersGateway,
  ) {}

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
    const courier = await this.prisma.courierProfile.update({
      where: { userId },
      data: { lat, lng },
    });
    await this.prisma.driverProfile.updateMany({
      where: { userId },
      data: { lat, lng },
    });

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
    });

    if (currentOrder) {
      this.courierOrdersGateway.emitCourierMoved(currentOrder.id, lat, lng);
    }

    return { success: true };
  }

  async getCurrentOrderForCourier(userId: string) {
    const courier = await this.requireCourierProfile(userId);

    return this.prisma.courierOrder.findFirst({
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
