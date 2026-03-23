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
import { IntercityOrdersModule } from './intercity-orders/intercity-orders.module';
import { IntercityDriversModule } from './intercity-drivers/intercity-drivers.module';
import { IntercityTripsModule } from './intercity-trips/intercity-trips.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
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
    IntercityOrdersModule,
    IntercityDriversModule,
    IntercityTripsModule,
    // GraphQLModule мы временно убрали, чтобы сервер запустился
  ],
})
export class AppModule {}
