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
} from '@prisma/client/index';
import { PrismaService } from '../prisma/prisma.service';
import { IntercityGateway } from '../intercity-trips/intercity.gateway';

@Injectable()
export class IntercityOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intercityGateway: IntercityGateway,
  ) {}

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
      stops?: string[];
      womenOnly?: boolean;
      baggageRequired?: boolean;
      noAnimals?: boolean;
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
      const driver = await this.prisma.driverProfile.findUnique({
        where: { id: data.driverId },
      });
      if (!driver?.supportsIntercity) {
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
          stops: data.stops?.length ? data.stops : undefined,
          womenOnly: data.womenOnly ?? false,
          baggageRequired: data.baggageRequired ?? false,
          noAnimals: data.noAnimals ?? false,
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

    const fullOrder = await this.getOrderByIdForPassenger(userId, order.id);
    this.intercityGateway.emitOrderUpdated(fullOrder);
    return fullOrder;
  }

  async getOrdersForPassenger(userId: string) {
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

  async getOrdersForDriver(userId: string) {
      const driver = await this.requireIntercityDriverProfile(userId);
      if (!driver) {
        return [];
      }
      return this.prisma.intercityOrder.findMany({
        where: { driverId: driver.id },
        include: this.getOrderInclude(),
        orderBy: { createdAt: 'desc' },
      });
  }

  async listAvailableDriverOffers(userId: string, filters?: { fromCity?: string; toCity?: string }) {
    await this.requireIntercityDriverProfile(userId);

    return this.prisma.intercityOrder.findMany({
      where: {
        driverId: null,
        status: IntercityOrderStatus.SEARCHING_DRIVER,
        departureAt: { gte: new Date() },
        fromCity: filters?.fromCity ? { contains: filters.fromCity, mode: 'insensitive' } : undefined,
        toCity: filters?.toCity ? { contains: filters.toCity, mode: 'insensitive' } : undefined,
      },
      include: this.getOrderInclude(),
      orderBy: [{ departureAt: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getOrderByIdForPassenger(userId: string, orderId: string) {
    const order = await this.prisma.intercityOrder.findUnique({
      where: { id: orderId },
      include: this.getOrderInclude(),
    });
    if (!order) {
      throw new NotFoundException('Intercity order not found');
    }
    const passenger = await this.prisma.passengerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!passenger || passenger.id !== order.passengerId) {
      throw new NotFoundException('Intercity order not found');
    }
    return order;
  }

  async getOrderByIdForDriver(userId: string, orderId: string) {
    const driver = await this.requireIntercityDriverProfile(userId);
    const order = await this.prisma.intercityOrder.findUnique({
      where: { id: orderId },
      include: this.getOrderInclude(),
    });
    if (!order) {
      throw new NotFoundException('Intercity order not found');
    }
    const canSeeOffer = order.driverId === null && order.status === IntercityOrderStatus.SEARCHING_DRIVER;
    if (order.driverId !== driver.id && !canSeeOffer) {
      throw new NotFoundException('Intercity order not found');
    }
    return order;
  }

  async acceptOrder(userId: string, orderId: string) {
    const driver = await this.requireIntercityDriverProfile(userId);

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

    const fullOrder = await this.getOrderByIdForDriver(userId, orderId);
    this.intercityGateway.emitOrderUpdated(fullOrder);
    return fullOrder;
  }

  async updateOrderStatus(userId: string, orderId: string, status: IntercityOrderStatus) {
    const driver = await this.requireIntercityDriverProfile(userId);

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

    const fullOrder = await this.getOrderByIdForDriver(userId, orderId);
    this.intercityGateway.emitOrderUpdated(fullOrder);
    return fullOrder;
  }

  async cancelOrderByPassenger(userId: string, orderId: string) {
    const passenger = await this.prisma.passengerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!passenger) {
      throw new NotFoundException('Passenger profile not found');
    }

    const order = await this.prisma.intercityOrder.findUnique({
      where: { id: orderId },
    });
    if (!order || order.passengerId !== passenger.id) {
      throw new NotFoundException('Intercity order not found');
    }

    const passengerCancelableStatuses: IntercityOrderStatus[] = [
      IntercityOrderStatus.SEARCHING_DRIVER,
      IntercityOrderStatus.CONFIRMED,
      IntercityOrderStatus.DRIVER_EN_ROUTE,
    ];

    if (!passengerCancelableStatuses.includes(order.status)) {
      throw new BadRequestException('Заявку уже нельзя отменить на этом этапе');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.intercityOrder.update({
        where: { id: orderId },
        data: { status: IntercityOrderStatus.CANCELED },
      });
      await tx.intercityOrderStatusHistory.create({
        data: {
          intercityOrderId: orderId,
          status: IntercityOrderStatus.CANCELED,
        },
      });
    });

    const fullOrder = await this.getOrderByIdForPassenger(userId, orderId);
    this.intercityGateway.emitOrderUpdated(fullOrder);
    return fullOrder;
  }

  async cancelOrderByDriver(userId: string, orderId: string) {
    const driver = await this.requireIntercityDriverProfile(userId);
    const order = await this.prisma.intercityOrder.findUnique({
      where: { id: orderId },
    });
    if (!order || order.driverId !== driver.id) {
      throw new NotFoundException('Intercity order not found');
    }

    const driverCancelableStatuses: IntercityOrderStatus[] = [
      IntercityOrderStatus.CONFIRMED,
      IntercityOrderStatus.DRIVER_EN_ROUTE,
      IntercityOrderStatus.BOARDING,
    ];

    if (!driverCancelableStatuses.includes(order.status)) {
      throw new BadRequestException('Эту заявку уже нельзя отменить');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.intercityOrder.update({
        where: { id: orderId },
        data: { status: IntercityOrderStatus.CANCELED },
      });
      await tx.intercityOrderStatusHistory.create({
        data: {
          intercityOrderId: orderId,
          status: IntercityOrderStatus.CANCELED,
        },
      });
    });

    const fullOrder = await this.getOrderByIdForDriver(userId, orderId);
    this.intercityGateway.emitOrderUpdated(fullOrder);
    return fullOrder;
  }

  private async requireIntercityDriverProfile(userId: string) {
    const existingProfile = await this.prisma.driverProfile.findUnique({
      where: { userId },
      include: { car: true },
    });
    if (existingProfile?.supportsIntercity) {
      return existingProfile;
    }
    throw new ForbiddenException('Межгородний режим недоступен для этого водителя');
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
          car: true,
        },
      },
      statusHistory: {
        orderBy: { createdAt: 'asc' as const },
      },
    } satisfies Prisma.IntercityOrderInclude;
  }
}
