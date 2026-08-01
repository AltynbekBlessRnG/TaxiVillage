import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';
import { FoodOrdersModule } from '../food-orders/food-orders.module';

@Module({
  imports: [AuthModule, FoodOrdersModule],
  controllers: [AdminController],
})
export class AdminModule {}

