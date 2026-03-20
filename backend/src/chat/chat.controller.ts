import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ChatService } from './chat.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { MessageSender } from '@prisma/client';

class SendMessageDto {
  @IsString()
  @MaxLength(500)
  content!: string;

  @IsOptional()
  @IsEnum(MessageSender)
  receiverType?: MessageSender;
}

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('messages/:rideId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async getChatMessages(@Req() req: any) {
    const userId: string = req.user.userId;
    const rideId: string = req.params.rideId;
    return this.chatService.getChatMessages(userId, rideId);
  }

  @Post('send/:rideId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async sendMessage(@Body() data: SendMessageDto, @Req() req: any) {
    const userId: string = req.user.userId;
    const rideId: string = req.params.rideId;
    return this.chatService.sendMessage(userId, rideId, {
      content: data.content,
      receiverType: data.receiverType ?? MessageSender.DRIVER,
    });
  }

  @Post('mark-read/:rideId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async markMessagesAsRead(@Req() req: any) {
    const userId: string = req.user.userId;
    const rideId: string = req.params.rideId;
    await this.chatService.markMessagesAsRead(userId, rideId);
    return { success: true };
  }
}
