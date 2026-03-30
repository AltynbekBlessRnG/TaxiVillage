import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IntercityTripsController } from './intercity-trips.controller';
import { IntercityBookingsController } from './intercity-bookings.controller';
import { IntercityTripsService } from './intercity-trips.service';
import { IntercityGateway } from './intercity.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [IntercityTripsController, IntercityBookingsController],
  providers: [IntercityTripsService, IntercityGateway],
  exports: [IntercityTripsService, IntercityGateway],
})
export class IntercityTripsModule {}
