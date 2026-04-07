import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IntercityOrdersController } from './intercity-orders.controller';
import { IntercityOrdersService } from './intercity-orders.service';
import { IntercityTripsModule } from '../intercity-trips/intercity-trips.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, IntercityTripsModule, NotificationsModule],
  controllers: [IntercityOrdersController],
  providers: [IntercityOrdersService],
  exports: [IntercityOrdersService],
})
export class IntercityOrdersModule {}
