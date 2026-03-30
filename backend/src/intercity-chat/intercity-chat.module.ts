import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IntercityChatController } from './intercity-chat.controller';
import { IntercityChatGateway } from './intercity-chat.gateway';
import { IntercityChatService } from './intercity-chat.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [IntercityChatController],
  providers: [IntercityChatService, IntercityChatGateway],
  exports: [IntercityChatService],
})
export class IntercityChatModule {}
