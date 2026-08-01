import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ModerationService } from './moderation.service';

describe('ModerationService', () => {
  const prisma = {
    user: { findFirst: jest.fn() },
    userBlock: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
    chatMessage: { findUnique: jest.fn() },
    messageReport: { create: jest.fn() },
  } as any;
  let service: ModerationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ModerationService(prisma);
  });

  it('rejects blocking the current user', async () => {
    await expect(service.blockUser('user-1', 'user-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects reports from users outside the message', async () => {
    prisma.chatMessage.findUnique.mockResolvedValue({
      id: 'message-1',
      senderUserId: 'sender',
      receiverUserId: 'receiver',
    });

    await expect(
      service.reportMessage('stranger', {
        messageId: 'message-1',
        reason: 'abuse',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('stores a report against the other message participant', async () => {
    prisma.chatMessage.findUnique.mockResolvedValue({
      id: 'message-1',
      senderUserId: 'sender',
      receiverUserId: 'receiver',
    });
    prisma.messageReport.create.mockResolvedValue({
      id: 'report-1',
      status: 'OPEN',
      createdAt: new Date(),
    });

    await expect(
      service.reportMessage('receiver', {
        messageId: 'message-1',
        reason: 'abuse',
      }),
    ).resolves.toMatchObject({ success: true });
    expect(prisma.messageReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reportedUserId: 'sender' }),
      }),
    );
  });
});
