import { BadRequestException } from '@nestjs/common';
import { MessageSender } from '@prisma/client';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  let prisma: any;
  let notificationsService: { sendPush: jest.Mock };
  let service: ChatService;

  beforeEach(() => {
    prisma = {
      ride: { findUnique: jest.fn() },
      chatMessage: {
        create: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };
    notificationsService = { sendPush: jest.fn() };
    service = new ChatService(prisma, notificationsService as any);
  });

  it('sends taxi chat message and pushes notification to the counterpart', async () => {
    prisma.ride.findUnique.mockResolvedValue({
      id: 'ride-1',
      passenger: { userId: 'passenger-user', fullName: 'Passenger', user: { phone: '+7701' } },
      driver: { userId: 'driver-user', fullName: 'Driver', user: { phone: '+7702', pushToken: 'push-token' } },
    });
    prisma.chatMessage.create.mockResolvedValue({
      id: 'msg-1',
      rideId: 'ride-1',
      content: 'Привет',
      senderUserId: 'passenger-user',
      senderType: MessageSender.PASSENGER,
      receiverUserId: 'driver-user',
      receiverType: MessageSender.DRIVER,
      createdAt: new Date('2026-03-31T10:00:00.000Z'),
      readAt: null,
      senderUser: { phone: '+7701' },
      receiverUser: { phone: '+7702', pushToken: 'push-token' },
    });

    const result = await service.sendMessage('passenger-user', 'ride-1', {
      content: '  Привет  ',
      receiverType: MessageSender.DRIVER,
    });

    expect(prisma.chatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rideId: 'ride-1',
          senderUserId: 'passenger-user',
          receiverUserId: 'driver-user',
          content: 'Привет',
        }),
      }),
    );
    expect(notificationsService.sendPush).toHaveBeenCalledWith(
      'push-token',
      expect.objectContaining({
        title: 'Новое сообщение',
        body: 'Привет',
        data: { type: 'CHAT_MESSAGE', rideId: 'ride-1' },
      }),
    );
    expect(result.senderName).toBe('Passenger');
    expect(result.receiverName).toBe('Driver');
  });

  it('marks only incoming unread ride messages as read', async () => {
    prisma.ride.findUnique.mockResolvedValue({
      id: 'ride-1',
      passenger: { userId: 'passenger-user', fullName: 'Passenger', user: { phone: '+7701' } },
      driver: { userId: 'driver-user', fullName: 'Driver', user: { phone: '+7702' } },
    });
    prisma.chatMessage.updateMany.mockResolvedValue({ count: 3 });

    const result = await service.markMessagesAsRead('passenger-user', 'ride-1');

    expect(prisma.chatMessage.updateMany).toHaveBeenCalledWith({
      where: {
        rideId: 'ride-1',
        receiverUserId: 'passenger-user',
        readAt: null,
      },
      data: {
        readAt: expect.any(Date),
      },
    });
    expect(result).toEqual({ success: true, updatedCount: 3 });
  });

  it('rejects ride chat when driver is missing', async () => {
    prisma.ride.findUnique.mockResolvedValue({
      id: 'ride-1',
      passenger: { userId: 'passenger-user', fullName: 'Passenger', user: { phone: '+7701' } },
      driver: null,
    });

    await expect(
      service.sendMessage('passenger-user', 'ride-1', {
        content: 'test',
        receiverType: MessageSender.DRIVER,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
