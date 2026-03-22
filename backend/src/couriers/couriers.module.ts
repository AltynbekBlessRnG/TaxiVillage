import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CourierOrdersModule } from '../courier-orders/courier-orders.module';
import { CouriersController } from './couriers.controller';
import { CouriersService } from './couriers.service';

@Module({
  imports: [PrismaModule, CourierOrdersModule],
  controllers: [CouriersController],
  providers: [CouriersService],
})
export class CouriersModule {}
