import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FoodOrdersController } from './food-orders.controller';
import { FoodOrdersService } from './food-orders.service';

@Module({
  imports: [PrismaModule],
  controllers: [FoodOrdersController],
  providers: [FoodOrdersService],
  exports: [FoodOrdersService],
})
export class FoodOrdersModule {}
