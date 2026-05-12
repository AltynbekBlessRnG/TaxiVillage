import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { FoodOrdersController } from './food-orders.controller';
import { FoodOrdersService } from './food-orders.service';
import { FoodOrdersGateway } from './food-orders.gateway';
import { NotificationsModule } from '../notifications/notifications.module';
import { getRequiredEnv } from '../common/required-env';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    JwtModule.register({
      secret: getRequiredEnv('JWT_SECRET'),
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [FoodOrdersController],
  providers: [FoodOrdersService, FoodOrdersGateway],
  exports: [FoodOrdersService],
})
export class FoodOrdersModule {}
