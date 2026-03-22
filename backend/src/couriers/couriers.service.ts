import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CourierOrderStatus, DriverStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CourierOrdersGateway } from '../courier-orders/courier-orders.gateway';

@Injectable()
export class CouriersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courierOrdersGateway: CourierOrdersGateway,
  ) {}

  async setOnlineStatus(userId: string, isOnline: boolean) {
    const courier = await this.prisma.courierProfile.findUnique({
      where: { userId },
    });
    if (!courier) {
      throw new NotFoundException('Профиль курьера не найден');
    }
    if (isOnline && courier.status !== DriverStatus.APPROVED) {
      throw new BadRequestException('Курьер не одобрен администратором');
    }
    return this.prisma.courierProfile.update({
      where: { userId },
      data: { isOnline },
    });
  }

  async updateLocation(userId: string, lat: number, lng: number) {
    const courier = await this.prisma.courierProfile.update({
      where: { userId },
      data: { lat, lng },
    });

    const currentOrder = await this.prisma.courierOrder.findFirst({
      where: {
        courierId: courier.id,
        status: {
          in: [
            CourierOrderStatus.TO_PICKUP,
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
    const courier = await this.prisma.courierProfile.findUnique({
      where: { userId },
    });
    if (!courier) {
      throw new NotFoundException('Courier profile not found');
    }

    return this.prisma.courierOrder.findFirst({
      where: {
        courierId: courier.id,
        status: {
          in: [
            CourierOrderStatus.TO_PICKUP,
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
