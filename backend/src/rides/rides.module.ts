import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RidesService } from './rides.service';
import { RidesController } from './rides.controller';
import { RidesGateway } from './rides.gateway';
import { NotificationsModule } from '../notifications/notifications.module'; 

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: '15m' },
    }),
    NotificationsModule, 
  ],
  providers: [RidesService, RidesGateway],
  controllers: [RidesController],
  exports: [RidesService, RidesGateway],
})
export class RidesModule {}