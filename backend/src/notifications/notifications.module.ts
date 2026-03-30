import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsQueueService } from './notifications-queue.service';

@Module({
  providers: [NotificationsService, NotificationsQueueService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
