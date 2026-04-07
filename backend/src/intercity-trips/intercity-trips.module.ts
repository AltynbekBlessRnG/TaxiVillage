import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IntercityTripsController } from './intercity-trips.controller';
import { IntercityBookingsController } from './intercity-bookings.controller';
import { IntercityTripsService } from './intercity-trips.service';
import { IntercityGateway } from './intercity.gateway';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  controllers: [IntercityTripsController, IntercityBookingsController],
  providers: [IntercityTripsService, IntercityGateway],
  exports: [IntercityTripsService, IntercityGateway],
})
export class IntercityTripsModule {}
