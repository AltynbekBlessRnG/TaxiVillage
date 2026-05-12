import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MessageSender, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

interface SendMessageDto {
  content: string;
  receiverType: MessageSender;
}

interface GetMessagesParams {
  cursor?: string;
  limit?: number;
}

export interface ChatThreadSummary {
  rideId: string;
  title: string;
  subtitle: string;
  lastMessage: string;
  lastMessageAt: Date;
  unreadCount: number;
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getChatMessages(userId: string, rideId: string, params: GetMessagesParams = {}) {
    const participant = await this.getRideParticipant(userId, rideId);
    const limit = Math.min(Math.max(params.limit ?? 30, 1), 100);

    const messages = await this.prisma.chatMessage.findMany({
      where: { rideId },
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

  async sendMessage(userId: string, rideId: string, data: SendMessageDto) {
    if (!data.content?.trim()) {
      throw new BadRequestException('Message content is required');
    }

    const participant = await this.getRideParticipant(userId, rideId);

    const receiverUserId =
      participant.senderType === MessageSender.PASSENGER
        ? participant.ride.driver?.userId
        : participant.ride.passenger?.userId;

    if (!receiverUserId) {
      throw new BadRequestException('Message receiver is unavailable');
    }

    const created = await this.prisma.chatMessage.create({
      data: {
        rideId,
        senderUserId: userId,
        senderType: participant.senderType,
        receiverUserId,
        receiverType:
          participant.senderType === MessageSender.PASSENGER
            ? MessageSender.DRIVER
            : MessageSender.PASSENGER,
        content: data.content.trim(),
      },
      include: {
        senderUser: true,
        receiverUser: true,
      },
    });

    await this.notificationsService.sendPush(created.receiverUser?.pushToken, {
      title: 'Новое сообщение',
      body: data.content.trim(),
      data: {
        type: 'CHAT_MESSAGE',
        rideId,
      },
    });

    return this.serializeMessage(created, participant);
  }

  async markMessagesAsRead(userId: string, rideId: string) {
    await this.getRideParticipant(userId, rideId);

    const result = await this.prisma.chatMessage.updateMany({
      where: {
        rideId,
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
        rideId: { not: null },
        receiverUserId: userId,
        readAt: null,
      },
    });

    return { unreadCount: count };
  }

  async getThreads(userId: string): Promise<{ items: ChatThreadSummary[] }> {
    const [messages, unreadMessages] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: {
          rideId: { not: null },
          OR: [{ senderUserId: userId }, { receiverUserId: userId }],
        },
        orderBy: { createdAt: 'desc' },
        include: {
          ride: {
            include: {
              passenger: { include: { user: true } },
              driver: { include: { user: true } },
            },
          },
        },
      }),
      this.prisma.chatMessage.findMany({
        where: {
          rideId: { not: null },
          receiverUserId: userId,
          readAt: null,
        },
        select: {
          rideId: true,
        },
      }),
    ]);

    const unreadByRideId = unreadMessages.reduce<Record<string, number>>((acc, item) => {
      if (!item.rideId) {
        return acc;
      }
      acc[item.rideId] = (acc[item.rideId] ?? 0) + 1;
      return acc;
    }, {});

    const seenRideIds = new Set<string>();
    const items: ChatThreadSummary[] = [];

    for (const message of messages) {
      if (!message.rideId || seenRideIds.has(message.rideId) || !message.ride) {
        continue;
      }

      seenRideIds.add(message.rideId);
      const isPassenger = message.ride.passenger?.userId === userId;
      const counterpart = isPassenger ? message.ride.driver : message.ride.passenger;
      const title = counterpart?.fullName ?? counterpart?.user?.phone ?? 'Диалог по поездке';
      const subtitle = `${message.ride.fromAddress} -> ${message.ride.toAddress}`;

      items.push({
        rideId: message.rideId,
        title,
        subtitle,
        lastMessage: message.content,
        lastMessageAt: message.createdAt,
        unreadCount: unreadByRideId[message.rideId] ?? 0,
      });
    }

    return { items };
  }

  async assertRideParticipant(userId: string, rideId: string) {
    await this.getRideParticipant(userId, rideId);
  }

  private async getRideParticipant(userId: string, rideId: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        passenger: { include: { user: true } },
        driver: { include: { user: true } },
      },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.passenger?.userId === userId) {
      return {
        ride,
        senderType: MessageSender.PASSENGER,
      };
    }

    if (ride.driver?.userId === userId) {
      return {
        ride,
        senderType: MessageSender.DRIVER,
      };
    }

    throw new ForbiddenException('You do not participate in this ride');
  }

  private serializeMessage(
    message: Prisma.ChatMessageGetPayload<{
      include: {
        senderUser: true;
        receiverUser: true;
      };
    }>,
    participant: Awaited<ReturnType<ChatService['getRideParticipant']>>,
  ) {
    return {
      id: message.id,
      rideId: message.rideId,
      content: message.content,
      senderId: message.senderUserId,
      senderType: message.senderType,
      receiverId: message.receiverUserId,
      receiverType: message.receiverType,
      createdAt: message.createdAt,
      readAt: message.readAt,
      senderName:
        message.senderType === MessageSender.PASSENGER
          ? participant.ride.passenger?.fullName ?? message.senderUser?.phone ?? 'Пользователь'
          : participant.ride.driver?.fullName ?? message.senderUser?.phone ?? 'Пользователь',
      receiverName:
        message.receiverType === MessageSender.PASSENGER
          ? participant.ride.passenger?.fullName ?? message.receiverUser?.phone ?? 'Пользователь'
          : participant.ride.driver?.fullName ?? message.receiverUser?.phone ?? 'Пользователь',
    };
  }
}
