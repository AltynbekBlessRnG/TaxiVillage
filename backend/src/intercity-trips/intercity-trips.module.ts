import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IntercityTripsController } from './intercity-trips.controller';
import { IntercityBookingsController } from './intercity-bookings.controller';
import { IntercityTripsService } from './intercity-trips.service';

@Module({
  imports: [PrismaModule],
  controllers: [IntercityTripsController, IntercityBookingsController],
  providers: [IntercityTripsService],
  exports: [IntercityTripsService],
})
export class IntercityTripsModule {}
