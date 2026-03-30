import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { AuthModule } from '../auth/auth.module'; 
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, NotificationsModule], 
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
