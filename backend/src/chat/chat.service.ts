import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MessageSender, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface SendMessageDto {
  content: string;
  receiverType: MessageSender;
}

interface GetMessagesParams {
  cursor?: string;
  limit?: number;
}

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async getChatMessages(userId: string, rideId: string, params: GetMessagesParams = {}) {
    const participant = await this.getRideParticipant(userId, rideId);
    const limit = Math.min(Math.max(params.limit ?? 30, 1), 100);

    const messages = await this.prisma.message.findMany({
      where: { rideId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      cursor: params.cursor ? { id: params.cursor } : undefined,
      skip: params.cursor ? 1 : 0,
      include: {
        sender: { include: { user: true } },
        driverSender: { include: { user: true } },
        receiver: { include: { user: true } },
        driverReceiver: { include: { user: true } },
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

    const receiverProfileId =
      participant.senderType === MessageSender.PASSENGER
        ? participant.ride.driverId
        : participant.ride.passengerId;

    if (!receiverProfileId) {
      throw new BadRequestException('Message receiver is unavailable');
    }

    const created = await this.prisma.message.create({
      data: {
        rideId,
        senderId: participant.profileId,
        senderType: participant.senderType,
        receiverId: receiverProfileId,
        receiverType:
          participant.senderType === MessageSender.PASSENGER
            ? MessageSender.DRIVER
            : MessageSender.PASSENGER,
        content: data.content.trim(),
      },
      include: {
        sender: { include: { user: true } },
        driverSender: { include: { user: true } },
        receiver: { include: { user: true } },
        driverReceiver: { include: { user: true } },
      },
    });

    return this.serializeMessage(created, participant);
  }

  async markMessagesAsRead(userId: string, rideId: string) {
    const participant = await this.getRideParticipant(userId, rideId);

    const result = await this.prisma.message.updateMany({
      where: {
        rideId,
        receiverId: participant.profileId,
        receiverType: participant.senderType,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return { success: true, updatedCount: result.count };
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
        profileId: ride.passenger.id,
        senderType: MessageSender.PASSENGER,
      };
    }

    if (ride.driver?.userId === userId) {
      return {
        ride,
        profileId: ride.driver.id,
        senderType: MessageSender.DRIVER,
      };
    }

    throw new ForbiddenException('You do not participate in this ride');
  }

  private serializeMessage(
    message: Prisma.MessageGetPayload<{
      include: {
        sender: { include: { user: true } };
        driverSender: { include: { user: true } };
        receiver: { include: { user: true } };
        driverReceiver: { include: { user: true } };
      };
    }>,
    participant: Awaited<ReturnType<ChatService['getRideParticipant']>>,
  ) {
    const senderProfile =
      message.senderType === MessageSender.PASSENGER
        ? message.sender
        : message.driverSender;
    const receiverProfile =
      message.receiverType === MessageSender.PASSENGER
        ? message.receiver
        : message.driverReceiver;

    return {
      id: message.id,
      rideId: message.rideId,
      content: message.content,
      senderId: senderProfile?.userId ?? participant.ride.passenger?.userId ?? '',
      senderType: message.senderType,
      receiverId:
        receiverProfile?.userId ?? participant.ride.driver?.userId ?? '',
      receiverType: message.receiverType,
      createdAt: message.createdAt,
      readAt: message.readAt,
      senderName:
        senderProfile?.fullName ?? senderProfile?.user?.phone ?? 'Пользователь',
      receiverName:
        receiverProfile?.fullName ??
        receiverProfile?.user?.phone ??
        'Пользователь',
    };
  }
}
