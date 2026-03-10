import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RidesService } from './rides.service';
import { RidesController } from './rides.controller';
import { RidesGateway } from './rides.gateway';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  providers: [RidesService, RidesGateway],
  controllers: [RidesController],
})
export class RidesModule {}

