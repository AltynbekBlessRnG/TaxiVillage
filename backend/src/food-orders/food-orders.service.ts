import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FoodOrderStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FoodOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrderForPassenger(
    userId: string,
    data: {
      merchantId: string;
      deliveryAddress: string;
      comment?: string;
      items: Array<{ menuItemId: string; qty: number }>;
      paymentMethod?: 'CARD' | 'CASH';
    },
  ) {
    const passenger = await this.prisma.passengerProfile.findUnique({
      where: { userId },
    });
    if (!passenger) {
      throw new NotFoundException('Passenger profile not found');
    }
    if (!data.items.length) {
      throw new BadRequestException('Корзина пуста');
    }

    const merchant = await this.prisma.merchant.findUnique({
      where: { id: data.merchantId },
      include: {
        menuCategories: {
          include: {
            items: true,
          },
        },
      },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const menuItems = merchant.menuCategories.flatMap((category) => category.items);
    const cartItems = data.items.map((item) => {
      const menuItem = menuItems.find((candidate) => candidate.id === item.menuItemId);
      if (!menuItem || !menuItem.isAvailable) {
        throw new BadRequestException('Одно из блюд недоступно');
      }
      return {
        menuItem,
        qty: item.qty,
      };
    });

    const total = cartItems.reduce(
      (sum, item) => sum + Number(item.menuItem.price) * item.qty,
      0,
    );

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.foodOrder.create({
        data: {
          passengerId: passenger.id,
          merchantId: merchant.id,
          deliveryAddress: data.deliveryAddress,
          comment: data.comment || null,
          paymentMethod: data.paymentMethod || 'CARD',
          totalPrice: new Prisma.Decimal(total),
          status: FoodOrderStatus.PLACED,
        },
      });

      for (const item of cartItems) {
        await tx.foodOrderItem.create({
          data: {
            foodOrderId: created.id,
            menuItemId: item.menuItem.id,
            name: item.menuItem.name,
            price: item.menuItem.price,
            qty: item.qty,
          },
        });
      }

      await tx.foodOrderStatusHistory.create({
        data: {
          foodOrderId: created.id,
          status: FoodOrderStatus.PLACED,
        },
      });

      return created;
    });

    return this.getOrderByIdForUser(userId, UserRole.PASSENGER, order.id);
  }

  async getOrdersForUser(userId: string, role: UserRole) {
    if (role === UserRole.PASSENGER) {
      const passenger = await this.prisma.passengerProfile.findUnique({
        where: { userId },
      });
      if (!passenger) {
        return [];
      }
      return this.prisma.foodOrder.findMany({
        where: { passengerId: passenger.id },
        include: this.getOrderInclude(),
        orderBy: { createdAt: 'desc' },
      });
    }

    if (role === UserRole.MERCHANT) {
      const merchant = await this.prisma.merchant.findUnique({
        where: { userId },
      });
      if (!merchant) {
        return [];
      }
      return this.prisma.foodOrder.findMany({
        where: { merchantId: merchant.id },
        include: this.getOrderInclude(),
        orderBy: { createdAt: 'desc' },
      });
    }

    if (role === UserRole.ADMIN) {
      return this.prisma.foodOrder.findMany({
        include: this.getOrderInclude(),
        orderBy: { createdAt: 'desc' },
      });
    }

    return [];
  }

  async getOrderByIdForUser(userId: string, role: UserRole, orderId: string) {
    const order = await this.prisma.foodOrder.findUnique({
      where: { id: orderId },
      include: this.getOrderInclude(),
    });
    if (!order) {
      throw new NotFoundException('Food order not found');
    }

    if (role === UserRole.ADMIN) {
      return order;
    }

    if (role === UserRole.PASSENGER) {
      const passenger = await this.prisma.passengerProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!passenger || passenger.id !== order.passengerId) {
        throw new NotFoundException('Food order not found');
      }
      return order;
    }

    if (role === UserRole.MERCHANT) {
      const merchant = await this.prisma.merchant.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!merchant || merchant.id !== order.merchantId) {
        throw new NotFoundException('Food order not found');
      }
      return order;
    }

    throw new ForbiddenException('Access denied');
  }

  async updateOrderStatusForMerchant(
    userId: string,
    orderId: string,
    status: FoodOrderStatus,
  ) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const order = await this.prisma.foodOrder.findUnique({
      where: { id: orderId },
    });
    if (!order || order.merchantId !== merchant.id) {
      throw new NotFoundException('Food order not found');
    }

    this.assertAllowedTransition(order.status, status);

    await this.prisma.$transaction(async (tx) => {
      await tx.foodOrder.update({
        where: { id: orderId },
        data: { status },
      });
      await tx.foodOrderStatusHistory.create({
        data: {
          foodOrderId: orderId,
          status,
        },
      });
    });

    return this.getOrderByIdForUser(userId, UserRole.MERCHANT, orderId);
  }

  private assertAllowedTransition(from: FoodOrderStatus, to: FoodOrderStatus) {
    const allowedTransitions: Record<FoodOrderStatus, FoodOrderStatus[]> = {
      [FoodOrderStatus.PLACED]: [FoodOrderStatus.ACCEPTED, FoodOrderStatus.CANCELED],
      [FoodOrderStatus.ACCEPTED]: [FoodOrderStatus.PREPARING, FoodOrderStatus.CANCELED],
      [FoodOrderStatus.PREPARING]: [FoodOrderStatus.READY_FOR_PICKUP],
      [FoodOrderStatus.READY_FOR_PICKUP]: [FoodOrderStatus.ON_DELIVERY],
      [FoodOrderStatus.ON_DELIVERY]: [FoodOrderStatus.DELIVERED],
      [FoodOrderStatus.DELIVERED]: [],
      [FoodOrderStatus.CANCELED]: [],
    };

    if (!allowedTransitions[from].includes(to)) {
      throw new BadRequestException(`Cannot change food order status from ${from} to ${to}`);
    }
  }

  private getOrderInclude() {
    return {
      passenger: {
        include: {
          user: true,
        },
      },
      merchant: true,
      items: true,
      statusHistory: {
        orderBy: { createdAt: 'asc' as const },
      },
    } satisfies Prisma.FoodOrderInclude;
  }
}
