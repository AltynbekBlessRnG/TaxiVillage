import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { RideResolver } from './ride.resolver';
import { DriverResolver } from './driver.resolver';
import { PassengerResolver } from './passenger.resolver';
import { RidesModule } from '../rides/rides.module';
import { DriversModule } from '../drivers/drivers.module';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/graphql/schema.gql'),
      sortSchema: true,
      playground: true,
      introspection: true,
    }),
    RidesModule,   // Добавили это
    DriversModule,
  ],
  providers: [
    RideResolver,
    DriverResolver,
    PassengerResolver,
  ],
})
export class AppGraphQLModule {}
