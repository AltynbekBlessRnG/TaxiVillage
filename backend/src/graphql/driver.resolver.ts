import { Resolver, Query, Args } from '@nestjs/graphql';
import { DriversService } from '../drivers/drivers.service';

@Resolver()
export class DriverResolver {
  constructor(private readonly driverService: DriversService) {}

  @Query(() => [String], { name: 'drivers' })
  async getDrivers() {
    // Временный возврат пустой строки для обхода ошибок типов
    return [];
  }

  @Query(() => String, { name: 'driver', nullable: true })
  async getDriver(@Args('id', { type: () => String }) id: string) {
    return null;
  }
}