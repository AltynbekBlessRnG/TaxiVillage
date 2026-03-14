import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessageSender } from '@prisma/client';

interface SendMessageDto {
  content: string;
  receiverId: string;
  receiverType: MessageSender;
}

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async getChatMessages(userId: string, rideId: string) {
    const messages = await this.prisma.message.findMany({
      where: {
        rideId,
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
    return messages;
  }

  async sendMessage(userId: string, rideId: string, data: SendMessageDto) {
    const ride = await this.prisma.ride.findFirst({
      where: {
        id: rideId,
        OR: [
          { passengerId: userId },
          { driverId: userId },
        ],
      },
    });

    if (!ride) {
      throw new BadRequestException('Вы не участвуете в этой поездке');
    }

    const senderType = data.receiverType === MessageSender.PASSENGER 
      ? MessageSender.DRIVER 
      : MessageSender.PASSENGER;

    return this.prisma.message.create({
      data: {
        rideId,
        senderId: userId,
        senderType,
        receiverId: data.receiverId,
        receiverType: data.receiverType,
        content: data.content,
      },
    });
  }

  async markMessagesAsRead(userId: string, rideId: string) {
    return { success: true };
  }
}