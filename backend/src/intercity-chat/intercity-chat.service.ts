import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MessageSender } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export type IntercityThreadType = 'ORDER' | 'BOOKING';

interface GetMessagesParams {
  cursor?: string;
  limit?: number;
}

export interface IntercityThreadSummary {
  threadType: IntercityThreadType;
  threadId: string;
  title: string;
  subtitle: string;
  lastMessage: string;
  lastMessageAt: Date;
  unreadCount: number;
}

@Injectable()
export class IntercityChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getMessages(
    userId: string,
    threadType: IntercityThreadType,
    threadId: string,
    params: GetMessagesParams = {},
  ) {
    const participant = await this.getParticipant(userId, threadType, threadId);
    const limit = Math.min(Math.max(params.limit ?? 30, 1), 100);

    const where =
      threadType === 'ORDER'
        ? { intercityOrderId: threadId }
        : { intercityBookingId: threadId };

    const messages = await this.prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      cursor: params.cursor ? { id: params.cursor } : undefined,
      skip: params.cursor ? 1 : 0,
      include: {
        senderUser: true,
        receiverUser: true,
      },
    });

    const hasMore = messages.length > limit;
    const pageItems = hasMore ? messages.slice(0, limit) : messages;
    const orderedItems = [...pageItems].reverse();

    return {
      items: orderedItems.map((message) => this.serializeMessage(message, participant)),
      nextCursor: hasMore ? pageItems[pageItems.length - 1]?.id ?? null : null,
      hasMore,
    };
  }

  async sendMessage(
    userId: string,
    threadType: IntercityThreadType,
    threadId: string,
    content: string,
  ) {
    if (!content?.trim()) {
      throw new BadRequestException('Message content is required');
    }

    const participant = await this.getParticipant(userId, threadType, threadId);

    const created = await this.prisma.chatMessage.create({
      data: {
        intercityOrderId: threadType === 'ORDER' ? threadId : undefined,
        intercityBookingId: threadType === 'BOOKING' ? threadId : undefined,
        senderUserId: userId,
        receiverUserId: participant.receiverUserId,
        senderType: participant.senderType,
        receiverType:
          participant.senderType === MessageSender.PASSENGER
            ? MessageSender.DRIVER
            : MessageSender.PASSENGER,
        content: content.trim(),
      },
      include: {
        senderUser: true,
        receiverUser: true,
      },
    });

    await this.notificationsService.sendPush(created.receiverUser?.pushToken, {
      title: 'Новое сообщение по межгороду',
      body: content.trim(),
      data: {
        type: 'INTERCITY_CHAT_MESSAGE',
        threadType,
        threadId,
      },
    });

    return this.serializeMessage(created, participant);
  }

  async markMessagesAsRead(userId: string, threadType: IntercityThreadType, threadId: string) {
    await this.getParticipant(userId, threadType, threadId);
    const where =
      threadType === 'ORDER'
        ? { intercityOrderId: threadId }
        : { intercityBookingId: threadId };

    const result = await this.prisma.chatMessage.updateMany({
      where: {
        ...where,
        receiverUserId: userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return { success: true, updatedCount: result.count };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.chatMessage.count({
      where: {
        receiverUserId: userId,
        readAt: null,
        OR: [
          { intercityOrderId: { not: null } },
          { intercityBookingId: { not: null } },
        ],
      },
    });

    return { unreadCount: count };
  }

  async getThreads(userId: string): Promise<{ items: IntercityThreadSummary[] }> {
    const [messages, unreadMessages] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: {
          AND: [
            {
              OR: [
                { intercityOrderId: { not: null } },
                { intercityBookingId: { not: null } },
              ],
            },
            {
              OR: [{ senderUserId: userId }, { receiverUserId: userId }],
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
        include: {
          intercityOrder: {
            include: {
              passenger: { include: { user: true } },
              driver: { include: { user: true } },
            },
          },
          intercityBooking: {
            include: {
              passenger: { include: { user: true } },
              trip: {
                include: {
                  driver: { include: { user: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.chatMessage.findMany({
        where: {
          receiverUserId: userId,
          readAt: null,
          OR: [
            { intercityOrderId: { not: null } },
            { intercityBookingId: { not: null } },
          ],
        },
        select: {
          intercityOrderId: true,
          intercityBookingId: true,
        },
      }),
    ]);

    const unreadByThread = unreadMessages.reduce<Record<string, number>>((acc, item) => {
      const key = item.intercityOrderId
        ? `ORDER:${item.intercityOrderId}`
        : item.intercityBookingId
        ? `BOOKING:${item.intercityBookingId}`
        : null;
      if (!key) {
        return acc;
      }
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const seenThreads = new Set<string>();
    const items: IntercityThreadSummary[] = [];

    for (const message of messages) {
      const threadType = message.intercityOrderId ? 'ORDER' : message.intercityBookingId ? 'BOOKING' : null;
      const threadId = message.intercityOrderId ?? message.intercityBookingId ?? null;
      if (!threadType || !threadId) {
        continue;
      }

      const threadKey = `${threadType}:${threadId}`;
      if (seenThreads.has(threadKey)) {
        continue;
      }
      seenThreads.add(threadKey);

      if (threadType === 'ORDER' && message.intercityOrder) {
        const order = message.intercityOrder;
        const isPassenger = order.passenger.userId === userId;
        const counterpart = isPassenger ? order.driver : order.passenger;
        items.push({
          threadType,
          threadId,
          title: counterpart?.fullName ?? counterpart?.user?.phone ?? 'Чат по заявке',
          subtitle: `${order.fromCity} -> ${order.toCity}`,
          lastMessage: message.content,
          lastMessageAt: message.createdAt,
          unreadCount: unreadByThread[threadKey] ?? 0,
        });
      }

      if (threadType === 'BOOKING' && message.intercityBooking) {
        const booking = message.intercityBooking;
        const isPassenger = booking.passenger.userId === userId;
        const counterpart = isPassenger ? booking.trip.driver : booking.passenger;
        items.push({
          threadType,
          threadId,
          title: counterpart?.fullName ?? counterpart?.user?.phone ?? 'Чат по брони',
          subtitle: `${booking.trip.fromCity} -> ${booking.trip.toCity}`,
          lastMessage: message.content,
          lastMessageAt: message.createdAt,
          unreadCount: unreadByThread[threadKey] ?? 0,
        });
      }
    }

    return { items };
  }

  async assertParticipant(userId: string, threadType: IntercityThreadType, threadId: string) {
    await this.getParticipant(userId, threadType, threadId);
  }

  private async getParticipant(userId: string, threadType: IntercityThreadType, threadId: string) {
    if (threadType === 'ORDER') {
      const order = await this.prisma.intercityOrder.findUnique({
        where: { id: threadId },
        include: {
          passenger: { include: { user: true } },
          driver: { include: { user: true } },
        },
      });

      if (!order) {
        throw new NotFoundException('Intercity order not found');
      }

      if (!order.driver?.userId) {
        throw new BadRequestException('Чат будет доступен после назначения водителя');
      }

      if (order.passenger.userId === userId) {
        return {
          threadType,
          threadId,
          senderType: MessageSender.PASSENGER,
          receiverUserId: order.driver.userId,
          senderName: order.passenger.fullName ?? order.passenger.user.phone ?? 'Пассажир',
          receiverName: order.driver.fullName ?? order.driver.user.phone ?? 'Водитель',
        };
      }

      if (order.driver.userId === userId) {
        return {
          threadType,
          threadId,
          senderType: MessageSender.DRIVER,
          receiverUserId: order.passenger.userId,
          senderName: order.driver.fullName ?? order.driver.user.phone ?? 'Водитель',
          receiverName: order.passenger.fullName ?? order.passenger.user.phone ?? 'Пассажир',
        };
      }
    }

    if (threadType === 'BOOKING') {
      const booking = await this.prisma.intercityBooking.findUnique({
        where: { id: threadId },
        include: {
          passenger: { include: { user: true } },
          trip: {
            include: {
              driver: { include: { user: true } },
            },
          },
        },
      });

      if (!booking) {
        throw new NotFoundException('Intercity booking not found');
      }

      if (!booking.trip.driver.userId) {
        throw new BadRequestException('Чат недоступен без водителя рейса');
      }

      if (booking.passenger.userId === userId) {
        return {
          threadType,
          threadId,
          senderType: MessageSender.PASSENGER,
          receiverUserId: booking.trip.driver.userId,
          senderName: booking.passenger.fullName ?? booking.passenger.user.phone ?? 'Пассажир',
          receiverName: booking.trip.driver.fullName ?? booking.trip.driver.user.phone ?? 'Водитель',
        };
      }

      if (booking.trip.driver.userId === userId) {
        return {
          threadType,
          threadId,
          senderType: MessageSender.DRIVER,
          receiverUserId: booking.passenger.userId,
          senderName: booking.trip.driver.fullName ?? booking.trip.driver.user.phone ?? 'Водитель',
          receiverName: booking.passenger.fullName ?? booking.passenger.user.phone ?? 'Пассажир',
        };
      }
    }

    throw new ForbiddenException('You do not participate in this intercity chat');
  }

  private serializeMessage(
    message: any,
    participant: Awaited<ReturnType<IntercityChatService['getParticipant']>>,
  ) {
    const senderName =
      message.senderType === participant.senderType
        ? participant.senderName
        : participant.receiverName;
    const receiverName =
      message.receiverType === participant.senderType
        ? participant.senderName
        : participant.receiverName;

    return {
      id: message.id,
      intercityOrderId: message.intercityOrderId,
      intercityBookingId: message.intercityBookingId,
      content: message.content,
      senderId: message.senderUserId,
      senderType: message.senderType,
      receiverId: message.receiverUserId,
      receiverType: message.receiverType,
      createdAt: message.createdAt,
      readAt: message.readAt,
      senderName,
      receiverName,
    };
  }
}
