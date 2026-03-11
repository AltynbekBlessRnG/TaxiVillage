import { Module } from '@nestjs/common';
import { FavoriteAddressesController } from './favorite-addresses.controller';
import { FavoriteAddressesService } from './favorite-addresses.service';

@Module({
  controllers: [FavoriteAddressesController],
  providers: [FavoriteAddressesService],
  exports: [FavoriteAddressesService],
})
export class FavoriteAddressesModule {}
