import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async getBlockedUserIds(userId: string) {
    const blocks = await this.prisma.userBlock.findMany({
      where: { blockerUserId: userId },
      select: { blockedUserId: true },
      orderBy: { createdAt: 'desc' },
    });
    return { blockedUserIds: blocks.map((block) => block.blockedUserId) };
  }

  async blockUser(blockerUserId: string, blockedUserId: string) {
    if (blockerUserId === blockedUserId) {
      throw new BadRequestException('Нельзя заблокировать собственный аккаунт');
    }

    const target = await this.prisma.user.findFirst({
      where: { id: blockedUserId, isDeleted: false },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException('Пользователь не найден');
    }

    await this.prisma.userBlock.upsert({
      where: {
        blockerUserId_blockedUserId: { blockerUserId, blockedUserId },
      },
      update: {},
      create: { blockerUserId, blockedUserId },
    });
    return { success: true };
  }

  async unblockUser(blockerUserId: string, blockedUserId: string) {
    await this.prisma.userBlock.deleteMany({
      where: { blockerUserId, blockedUserId },
    });
    return { success: true };
  }

  async reportMessage(
    reporterUserId: string,
    input: { messageId: string; reason: string; context?: string },
  ) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: input.messageId },
      select: { id: true, senderUserId: true, receiverUserId: true },
    });
    if (!message) {
      throw new NotFoundException('Сообщение не найдено');
    }
    if (message.senderUserId !== reporterUserId && message.receiverUserId !== reporterUserId) {
      throw new ForbiddenException('Нет доступа к этому сообщению');
    }

    const reportedUserId =
      message.senderUserId === reporterUserId ? message.receiverUserId : message.senderUserId;
    const report = await this.prisma.messageReport.create({
      data: {
        reporterUserId,
        reportedUserId,
        messageId: message.id,
        reason: input.reason.trim(),
        context: input.context?.trim() || null,
      },
      select: { id: true, status: true, createdAt: true },
    });
    return { success: true, report };
  }

  async isBlockedBetween(firstUserId: string, secondUserId: string) {
    return Boolean(
      await this.prisma.userBlock.findFirst({
        where: {
          OR: [
            { blockerUserId: firstUserId, blockedUserId: secondUserId },
            { blockerUserId: secondUserId, blockedUserId: firstUserId },
          ],
        },
        select: { id: true },
      }),
    );
  }

  async getBlockedCounterpartIds(userId: string, candidateUserIds: string[]) {
    if (candidateUserIds.length === 0) {
      return new Set<string>();
    }
    const blocks = await this.prisma.userBlock.findMany({
      where: {
        OR: [
          { blockerUserId: userId, blockedUserId: { in: candidateUserIds } },
          { blockedUserId: userId, blockerUserId: { in: candidateUserIds } },
        ],
      },
      select: { blockerUserId: true, blockedUserId: true },
    });
    return new Set(
      blocks.map((block) =>
        block.blockerUserId === userId ? block.blockedUserId : block.blockerUserId,
      ),
    );
  }
}
