import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RidesService } from './rides.service';
import { RidesController } from './rides.controller';
import { RidesGateway } from './rides.gateway';
import { NotificationsModule } from '../notifications/notifications.module'; 
import { getRequiredEnv } from '../common/required-env';

@Module({
  imports: [
    JwtModule.register({
      secret: getRequiredEnv('JWT_SECRET'),
      signOptions: { expiresIn: '15m' },
    }),
    NotificationsModule, 
  ],
  providers: [RidesService, RidesGateway],
  controllers: [RidesController],
  exports: [RidesService, RidesGateway],
})
export class RidesModule {}