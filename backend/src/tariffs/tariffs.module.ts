import { Module } from '@nestjs/common';
import { TariffsService } from './tariffs.service';
import { TariffsController } from './tariffs.controller';

@Module({
  providers: [TariffsService],
  controllers: [TariffsController],
  exports: [TariffsService],
})
export class TariffsModule {}
