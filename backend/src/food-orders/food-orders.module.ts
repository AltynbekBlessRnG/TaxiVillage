import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FoodOrdersController } from './food-orders.controller';
import { FoodOrdersService } from './food-orders.service';
import { FoodOrdersGateway } from './food-orders.gateway';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [FoodOrdersController],
  providers: [FoodOrdersService, FoodOrdersGateway],
  exports: [FoodOrdersService],
})
export class FoodOrdersModule {}
