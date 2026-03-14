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
    // GraphQLModule мы временно убрали, чтобы сервер запустился
  ],
})
export class AppModule {}