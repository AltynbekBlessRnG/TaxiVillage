import { Module } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { DriversController } from './drivers.controller';
import { UploadModule } from '../upload/upload.module';
import { RidesModule } from '../rides/rides.module';

@Module({
  imports: [UploadModule, RidesModule],
  providers: [DriversService],
  controllers: [DriversController],
  exports: [DriversService],
})
export class DriversModule {}

