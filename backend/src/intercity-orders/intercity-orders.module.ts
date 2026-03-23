import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IntercityOrdersController } from './intercity-orders.controller';
import { IntercityOrdersService } from './intercity-orders.service';

@Module({
  imports: [PrismaModule],
  controllers: [IntercityOrdersController],
  providers: [IntercityOrdersService],
  exports: [IntercityOrdersService],
})
export class IntercityOrdersModule {}
