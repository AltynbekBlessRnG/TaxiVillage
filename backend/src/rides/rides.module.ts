import { Module } from '@nestjs/common';
import { RidesService } from './rides.service';
import { RidesController } from './rides.controller';

@Module({
  providers: [RidesService],
  controllers: [RidesController],
})
export class RidesModule {}

