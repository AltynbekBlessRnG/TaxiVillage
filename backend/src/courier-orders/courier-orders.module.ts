import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CourierOrdersController } from './courier-orders.controller';
import { CourierOrdersService } from './courier-orders.service';
import { CourierOrdersGateway } from './courier-orders.gateway';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [CourierOrdersController],
  providers: [CourierOrdersService, CourierOrdersGateway],
  exports: [CourierOrdersService, CourierOrdersGateway],
})
export class CourierOrdersModule {}
