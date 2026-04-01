import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RidesModule } from './rides/rides.module';
import { DriversModule } from './drivers/drivers.module';
import { AdminModule } from './admin/admin.module';
import { UploadModule } from './upload/upload.module';
import { TariffsModule } from './tariffs/tariffs.module';
import { FavoriteAddressesModule } from './favorite-addresses/favorite-addresses.module';
import { ChatModule } from './chat/chat.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CourierOrdersModule } from './courier-orders/courier-orders.module';
import { CouriersModule } from './couriers/couriers.module';
import { MerchantsModule } from './merchants/merchants.module';
import { FoodOrdersModule } from './food-orders/food-orders.module';
import { IntercityTripsModule } from './intercity-trips/intercity-trips.module';
import { IntercityChatModule } from './intercity-chat/intercity-chat.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.ENV_FILE || '.env',
    }),
    RedisModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    RidesModule,
    DriversModule,
    AdminModule,
    UploadModule,
    TariffsModule,
    FavoriteAddressesModule,
    ChatModule,
    NotificationsModule,
    CourierOrdersModule,
    CouriersModule,
    MerchantsModule,
    FoodOrdersModule,
    IntercityTripsModule,
    IntercityChatModule,
  ],
})
export class AppModule {}
