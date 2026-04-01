import { BadRequestException } from '@nestjs/common';
import { MessageSender } from '@prisma/client';
import { IntercityChatService } from './intercity-chat.service';

describe('IntercityChatService', () => {
  let prisma: any;
  let notificationsService: { sendPush: jest.Mock };
  let service: IntercityChatService;

  beforeEach(() => {
    prisma = {
      intercityOrder: { findUnique: jest.fn() },
      intercityBooking: { findUnique: jest.fn() },
      chatMessage: {
        create: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };
    notificationsService = { sendPush: jest.fn() };
    service = new IntercityChatService(prisma, notificationsService as any);
  });

  it('sends intercity order chat message and notifies receiver', async () => {
    prisma.intercityOrder.findUnique.mockResolvedValue({
      id: 'order-1',
      fromCity: 'Алматы',
      toCity: 'Астана',
      passenger: { userId: 'passenger-user', fullName: 'Passenger', user: { phone: '+7701' } },
      driver: { userId: 'driver-user', fullName: 'Driver', user: { phone: '+7702', pushToken: 'push-token' } },
    });
    prisma.chatMessage.create.mockResolvedValue({
      id: 'msg-1',
      intercityOrderId: 'order-1',
      intercityBookingId: null,
      content: 'Еду завтра',
      senderUserId: 'passenger-user',
      senderType: MessageSender.PASSENGER,
      receiverUserId: 'driver-user',
      receiverType: MessageSender.DRIVER,
      createdAt: new Date('2026-03-31T10:00:00.000Z'),
      readAt: null,
      senderUser: { phone: '+7701' },
      receiverUser: { phone: '+7702', pushToken: 'push-token' },
    });

    const result = await service.sendMessage(
      'passenger-user',
      'ORDER',
      'order-1',
      '  Еду завтра  ',
    );

    expect(prisma.chatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          intercityOrderId: 'order-1',
          senderUserId: 'passenger-user',
          receiverUserId: 'driver-user',
          content: 'Еду завтра',
        }),
      }),
    );
    expect(notificationsService.sendPush).toHaveBeenCalledWith(
      'push-token',
      expect.objectContaining({
        title: 'Новое сообщение по межгороду',
        body: 'Еду завтра',
        data: { type: 'INTERCITY_CHAT_MESSAGE', threadType: 'ORDER', threadId: 'order-1' },
      }),
    );
    expect(result.senderName).toBe('Passenger');
    expect(result.receiverName).toBe('Driver');
  });

  it('rejects intercity order chat before driver is assigned', async () => {
    prisma.intercityOrder.findUnique.mockResolvedValue({
      id: 'order-1',
      passenger: { userId: 'passenger-user', fullName: 'Passenger', user: { phone: '+7701' } },
      driver: null,
    });

    await expect(
      service.sendMessage('passenger-user', 'ORDER', 'order-1', 'test'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marks only unread intercity thread messages for current receiver', async () => {
    prisma.intercityBooking.findUnique.mockResolvedValue({
      id: 'booking-1',
      passenger: { userId: 'passenger-user', fullName: 'Passenger', user: { phone: '+7701' } },
      trip: {
        driver: { userId: 'driver-user', fullName: 'Driver', user: { phone: '+7702' } },
      },
    });
    prisma.chatMessage.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.markMessagesAsRead('passenger-user', 'BOOKING', 'booking-1');

    expect(prisma.chatMessage.updateMany).toHaveBeenCalledWith({
      where: {
        intercityBookingId: 'booking-1',
        receiverUserId: 'passenger-user',
        readAt: null,
      },
      data: {
        readAt: expect.any(Date),
      },
    });
    expect(result).toEqual({ success: true, updatedCount: 2 });
  });
});
