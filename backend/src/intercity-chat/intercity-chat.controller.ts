import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsString, MaxLength } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { IntercityChatService, IntercityThreadType } from './intercity-chat.service';

class SendIntercityMessageDto {
  @IsIn(['ORDER', 'BOOKING', 'TRIP'])
  threadType!: IntercityThreadType;

  @IsString()
  threadId!: string;

  @IsString()
  @MaxLength(500)
  content!: string;
}

class MarkIntercityMessagesReadDto {
  @IsIn(['ORDER', 'BOOKING', 'TRIP'])
  threadType!: IntercityThreadType;

  @IsString()
  threadId!: string;
}

@Controller('intercity-chat')
export class IntercityChatController {
  constructor(private readonly intercityChatService: IntercityChatService) {}

  @Get('messages')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  getMessages(
    @Req() req: any,
    @Query('threadType') threadType: IntercityThreadType,
    @Query('threadId') threadId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.intercityChatService.getMessages(req.user.userId, threadType, threadId, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('send')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  sendMessage(@Req() req: any, @Body() dto: SendIntercityMessageDto) {
    return this.intercityChatService.sendMessage(
      req.user.userId,
      dto.threadType,
      dto.threadId,
      dto.content,
    );
  }

  @Post('mark-read')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  markRead(@Req() req: any, @Body() dto: MarkIntercityMessagesReadDto) {
    return this.intercityChatService.markMessagesAsRead(req.user.userId, dto.threadType, dto.threadId);
  }

  @Get('unread-count')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  getUnreadCount(@Req() req: any) {
    return this.intercityChatService.getUnreadCount(req.user.userId);
  }

  @Get('threads')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  getThreads(@Req() req: any) {
    return this.intercityChatService.getThreads(req.user.userId);
  }
}
