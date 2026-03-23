import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IntercityDriversController } from './intercity-drivers.controller';
import { IntercityDriversService } from './intercity-drivers.service';

@Module({
  imports: [PrismaModule],
  controllers: [IntercityDriversController],
  providers: [IntercityDriversService],
})
export class IntercityDriversModule {}
