import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IntercityBookingStatus, MessageSender } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export type IntercityThreadType = 'ORDER' | 'BOOKING' | 'TRIP';

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

type ParticipantContext = {
  threadType: IntercityThreadType;
  threadId: string;
  senderType: MessageSender;
  senderName: string;
  receiverName: string;
  receiverUserId?: string;
  receiverUserIds?: string[];
  driverUserId?: string;
};

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

    const where = this.buildThreadWhere(threadType, threadId);
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

    const normalizedMessages =
      threadType === 'TRIP'
        ? messages.filter(
            (message, index, collection) =>
              collection.findIndex(
                (candidate) =>
                  (candidate.messageGroupId ?? candidate.id) === (message.messageGroupId ?? message.id),
              ) === index,
          )
        : messages;

    const hasMore = normalizedMessages.length > limit;
    const pageItems = hasMore ? normalizedMessages.slice(0, limit) : normalizedMessages;
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

    if (threadType === 'TRIP') {
      return this.sendTripMessage(userId, threadId, content.trim(), participant);
    }

    const created = await this.prisma.chatMessage.create({
      data: {
        intercityOrderId: threadType === 'ORDER' ? threadId : undefined,
        intercityBookingId: threadType === 'BOOKING' ? threadId : undefined,
        senderUserId: userId,
        receiverUserId: participant.receiverUserId!,
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

    const result = await this.prisma.chatMessage.updateMany({
      where: {
        ...this.buildThreadWhere(threadType, threadId),
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
          { intercityTripId: { not: null } },
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
                { intercityTripId: { not: null } },
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
          intercityTrip: {
            include: {
              driver: { include: { user: true } },
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
            { intercityTripId: { not: null } },
          ],
        },
        select: {
          intercityOrderId: true,
          intercityBookingId: true,
          intercityTripId: true,
        },
      }),
    ]);

    const unreadByThread = unreadMessages.reduce<Record<string, number>>((acc, item) => {
      const key = item.intercityOrderId
        ? `ORDER:${item.intercityOrderId}`
        : item.intercityBookingId
        ? `BOOKING:${item.intercityBookingId}`
        : item.intercityTripId
        ? `TRIP:${item.intercityTripId}`
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
      const threadType = message.intercityOrderId
        ? 'ORDER'
        : message.intercityBookingId
        ? 'BOOKING'
        : message.intercityTripId
        ? 'TRIP'
        : null;
      const threadId = message.intercityOrderId ?? message.intercityBookingId ?? message.intercityTripId ?? null;
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
          subtitle: `${order.fromCity} → ${order.toCity}`,
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
          subtitle: `${booking.trip.fromCity} → ${booking.trip.toCity}`,
          lastMessage: message.content,
          lastMessageAt: message.createdAt,
          unreadCount: unreadByThread[threadKey] ?? 0,
        });
      }

      if (threadType === 'TRIP' && message.intercityTrip) {
        items.push({
          threadType,
          threadId,
          title: `Рейс ${message.intercityTrip.fromCity} → ${message.intercityTrip.toCity}`,
          subtitle: formatTripSubtitle(message.intercityTrip.departureAt),
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

  private async sendTripMessage(
    userId: string,
    threadId: string,
    content: string,
    participant: ParticipantContext,
  ) {
    const messageGroupId = randomUUID();
    const recipients = Array.from(new Set([userId, ...(participant.receiverUserIds ?? [])]));

    const createdMessages = await this.prisma.$transaction(
      recipients.map((receiverUserId) =>
        this.prisma.chatMessage.create({
          data: {
            intercityTripId: threadId,
            messageGroupId,
            senderUserId: userId,
            receiverUserId,
            senderType: participant.senderType,
            receiverType: receiverUserId === participant.driverUserId ? MessageSender.DRIVER : MessageSender.PASSENGER,
            content,
          },
          include: {
            senderUser: true,
            receiverUser: true,
          },
        }),
      ),
    );

    await Promise.all(
      createdMessages
        .filter((message) => message.receiverUserId !== userId)
        .map((message) =>
          this.notificationsService.sendPush(message.receiverUser?.pushToken, {
            title: 'Новое сообщение по рейсу',
            body: content,
            data: {
              type: 'INTERCITY_CHAT_MESSAGE',
              threadType: 'TRIP',
              threadId,
            },
          }),
        ),
    );

    const currentUserMessage =
      createdMessages.find((message) => message.receiverUserId === userId) ?? createdMessages[0];

    return this.serializeMessage(currentUserMessage, participant);
  }

  private async getParticipant(userId: string, threadType: IntercityThreadType, threadId: string): Promise<ParticipantContext> {
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

    if (threadType === 'TRIP') {
      const trip = await this.prisma.intercityTrip.findUnique({
        where: { id: threadId },
        include: {
          driver: { include: { user: true } },
          bookings: {
            where: {
              status: {
                in: [
                  IntercityBookingStatus.CONFIRMED,
                  IntercityBookingStatus.BOARDING,
                  IntercityBookingStatus.IN_PROGRESS,
                ],
              },
            },
            include: {
              passenger: { include: { user: true } },
            },
          },
        },
      });

      if (!trip) {
        throw new NotFoundException('Intercity trip not found');
      }

      const activePassenger = trip.bookings.find((booking) => booking.passenger.userId === userId);
      const isDriver = trip.driver.userId === userId;

      if (!isDriver && !activePassenger) {
        throw new ForbiddenException('You do not participate in this intercity chat');
      }

      return {
        threadType,
        threadId,
        senderType: isDriver ? MessageSender.DRIVER : MessageSender.PASSENGER,
        senderName: isDriver
          ? trip.driver.fullName ?? trip.driver.user.phone ?? 'Водитель'
          : activePassenger?.passenger.fullName ?? activePassenger?.passenger.user.phone ?? 'Пассажир',
        receiverName: 'Чат рейса',
        receiverUserIds: [
          trip.driver.userId,
          ...trip.bookings.map((booking) => booking.passenger.userId),
        ].filter((participantId) => participantId !== userId),
        driverUserId: trip.driver.userId,
      };
    }

    throw new ForbiddenException('You do not participate in this intercity chat');
  }

  private buildThreadWhere(threadType: IntercityThreadType, threadId: string) {
    if (threadType === 'ORDER') {
      return { intercityOrderId: threadId };
    }
    if (threadType === 'BOOKING') {
      return { intercityBookingId: threadId };
    }
    return { intercityTripId: threadId };
  }

  private serializeMessage(message: any, participant: ParticipantContext) {
    const senderName =
      participant.threadType === 'TRIP'
        ? message.senderUser?.phone ?? participant.senderName
        : message.senderType === participant.senderType
        ? participant.senderName
        : participant.receiverName;
    const receiverName =
      participant.threadType === 'TRIP'
        ? 'Чат рейса'
        : message.receiverType === participant.senderType
        ? participant.senderName
        : participant.receiverName;

    return {
      id: message.messageGroupId ?? message.id,
      intercityOrderId: message.intercityOrderId,
      intercityBookingId: message.intercityBookingId,
      intercityTripId: message.intercityTripId,
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

function formatTripSubtitle(date: Date) {
  return new Date(date).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}
