import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IntercityOrderStatus,
  Prisma,
  UserRole,
} from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IntercityOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrderForPassenger(
    userId: string,
    data: {
      fromCity: string;
      toCity: string;
      departureAt: Date;
      seats: number;
      baggage?: string;
      comment?: string;
      price: number;
      driverId?: string;
    },
  ) {
    const passenger = await this.prisma.passengerProfile.findUnique({
      where: { userId },
    });
    if (!passenger) {
      throw new NotFoundException('Passenger profile not found');
    }

    const activeOrder = await this.prisma.intercityOrder.findFirst({
      where: {
        passengerId: passenger.id,
        status: {
          in: [
            IntercityOrderStatus.SEARCHING_DRIVER,
            IntercityOrderStatus.CONFIRMED,
            IntercityOrderStatus.DRIVER_EN_ROUTE,
            IntercityOrderStatus.BOARDING,
            IntercityOrderStatus.IN_PROGRESS,
          ],
        },
      },
    });
    if (activeOrder) {
      throw new ConflictException('У вас уже есть активная междугородняя поездка');
    }

    let assignedDriverId: string | null = null;
    let initialStatus: IntercityOrderStatus = IntercityOrderStatus.SEARCHING_DRIVER;

    if (data.driverId) {
      const driver = await this.prisma.intercityDriverProfile.findUnique({
        where: { id: data.driverId },
      });
      if (!driver) {
        throw new NotFoundException('Intercity driver not found');
      }
      assignedDriverId = driver.id;
      initialStatus = IntercityOrderStatus.CONFIRMED;
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.intercityOrder.create({
        data: {
          passengerId: passenger.id,
          driverId: assignedDriverId,
          fromCity: data.fromCity,
          toCity: data.toCity,
          departureAt: data.departureAt,
          seats: data.seats,
          baggage: data.baggage || null,
          comment: data.comment || null,
          price: new Prisma.Decimal(data.price),
          status: initialStatus,
        },
      });

      await tx.intercityOrderStatusHistory.create({
        data: {
          intercityOrderId: created.id,
          status: initialStatus,
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
      return this.prisma.intercityOrder.findMany({
        where: { passengerId: passenger.id },
        include: this.getOrderInclude(),
        orderBy: { createdAt: 'desc' },
      });
    }

    if (role === UserRole.DRIVER_INTERCITY) {
      const driver = await this.prisma.intercityDriverProfile.findUnique({
        where: { userId },
      });
      if (!driver) {
        return [];
      }
      return this.prisma.intercityOrder.findMany({
        where: { driverId: driver.id },
        include: this.getOrderInclude(),
        orderBy: { createdAt: 'desc' },
      });
    }

    if (role === UserRole.ADMIN) {
      return this.prisma.intercityOrder.findMany({
        include: this.getOrderInclude(),
        orderBy: { createdAt: 'desc' },
      });
    }

    return [];
  }

  async listAvailableDriverOffers(userId: string) {
    const driver = await this.prisma.intercityDriverProfile.findUnique({
      where: { userId },
    });
    if (!driver) {
      throw new NotFoundException('Intercity driver profile not found');
    }

    return this.prisma.intercityOrder.findMany({
      where: {
        driverId: null,
        status: IntercityOrderStatus.SEARCHING_DRIVER,
      },
      include: this.getOrderInclude(),
      orderBy: [{ departureAt: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getOrderByIdForUser(userId: string, role: UserRole, orderId: string) {
    const order = await this.prisma.intercityOrder.findUnique({
      where: { id: orderId },
      include: this.getOrderInclude(),
    });
    if (!order) {
      throw new NotFoundException('Intercity order not found');
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
        throw new NotFoundException('Intercity order not found');
      }
      return order;
    }

    if (role === UserRole.DRIVER_INTERCITY) {
      const driver = await this.prisma.intercityDriverProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      const canSeeOffer =
        order.driverId === null && order.status === IntercityOrderStatus.SEARCHING_DRIVER;
      if (!driver || (order.driverId !== driver.id && !canSeeOffer)) {
        throw new NotFoundException('Intercity order not found');
      }
      return order;
    }

    throw new ForbiddenException('Access denied');
  }

  async acceptOrder(userId: string, orderId: string) {
    const driver = await this.prisma.intercityDriverProfile.findUnique({
      where: { userId },
    });
    if (!driver) {
      throw new NotFoundException('Intercity driver profile not found');
    }

    await this.prisma.$transaction(async (tx) => {
      const result = await tx.intercityOrder.updateMany({
        where: {
          id: orderId,
          driverId: null,
          status: IntercityOrderStatus.SEARCHING_DRIVER,
        },
        data: {
          driverId: driver.id,
          status: IntercityOrderStatus.CONFIRMED,
        },
      });

      if (result.count === 0) {
        throw new ConflictException('Offer is no longer available');
      }

      await tx.intercityOrderStatusHistory.create({
        data: {
          intercityOrderId: orderId,
          status: IntercityOrderStatus.CONFIRMED,
        },
      });
    });

    return this.getOrderByIdForUser(userId, UserRole.DRIVER_INTERCITY, orderId);
  }

  async updateOrderStatus(userId: string, orderId: string, status: IntercityOrderStatus) {
    const driver = await this.prisma.intercityDriverProfile.findUnique({
      where: { userId },
    });
    if (!driver) {
      throw new NotFoundException('Intercity driver profile not found');
    }

    const order = await this.prisma.intercityOrder.findUnique({
      where: { id: orderId },
    });
    if (!order || order.driverId !== driver.id) {
      throw new NotFoundException('Intercity order not found');
    }

    this.assertAllowedTransition(order.status, status);

    await this.prisma.$transaction(async (tx) => {
      await tx.intercityOrder.update({
        where: { id: orderId },
        data: { status },
      });
      await tx.intercityOrderStatusHistory.create({
        data: {
          intercityOrderId: orderId,
          status,
        },
      });
    });

    return this.getOrderByIdForUser(userId, UserRole.DRIVER_INTERCITY, orderId);
  }

  private assertAllowedTransition(from: IntercityOrderStatus, to: IntercityOrderStatus) {
    const allowedTransitions: Record<IntercityOrderStatus, IntercityOrderStatus[]> = {
      [IntercityOrderStatus.SEARCHING_DRIVER]: [IntercityOrderStatus.CONFIRMED, IntercityOrderStatus.CANCELED],
      [IntercityOrderStatus.CONFIRMED]: [IntercityOrderStatus.DRIVER_EN_ROUTE, IntercityOrderStatus.CANCELED],
      [IntercityOrderStatus.DRIVER_EN_ROUTE]: [IntercityOrderStatus.BOARDING],
      [IntercityOrderStatus.BOARDING]: [IntercityOrderStatus.IN_PROGRESS],
      [IntercityOrderStatus.IN_PROGRESS]: [IntercityOrderStatus.COMPLETED],
      [IntercityOrderStatus.COMPLETED]: [],
      [IntercityOrderStatus.CANCELED]: [],
    };

    if (!allowedTransitions[from].includes(to)) {
      throw new BadRequestException(`Cannot change intercity order status from ${from} to ${to}`);
    }
  }

  private getOrderInclude() {
    return {
      passenger: {
        include: {
          user: true,
        },
      },
      driver: {
        include: {
          user: true,
        },
      },
      statusHistory: {
        orderBy: { createdAt: 'asc' as const },
      },
    } satisfies Prisma.IntercityOrderInclude;
  }
}
