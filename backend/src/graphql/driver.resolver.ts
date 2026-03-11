import { Resolver, Query, Args } from '@nestjs/graphql';
import { DriverService } from '../drivers/drivers.service';
import { DriverProfile } from '@prisma/client';

@Resolver(() => DriverProfile)
export class DriverResolver {
  constructor(private readonly driverService: DriverService) {}

  @Query(() => [DriverProfile], { name: 'drivers' })
  async getDrivers() {
    return this.driverService.getAvailableDrivers();
  }

  @Query(() => DriverProfile, { name: 'driver', nullable: true })
  async getDriver(@Args('id', { type: () => String }) id: string) {
    return this.driverService.getDriverById(id);
  }
}
