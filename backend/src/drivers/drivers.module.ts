import { Module } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { DriversController } from './drivers.controller';

@Module({
  providers: [DriversService],
  controllers: [DriversController],
})
export class DriversModule {}

