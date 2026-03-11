import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { RideService } from '../rides/rides.service';
import { Ride } from '@prisma/client';

@Resolver(() => Ride)
export class RideResolver {
  constructor(private readonly rideService: RideService) {}

  @Query(() => [Ride], { name: 'rides' })
  async getRides(@Args('userId', { type: () => String }) userId: string) {
    return this.rideService.getRidesForUser(userId, 'PASSENGER');
  }

  @Query(() => Ride, { name: 'ride', nullable: true })
  async getRide(@Args('id', { type: () => String }) id: string) {
    return this.rideService.getRideById(id);
  }

  @Mutation(() => Ride, { name: 'createRide' })
  async createRide(
    @Args('passengerId', { type: () => String }) passengerId: string,
    @Args('fromAddress', { type: () => String }) fromAddress: string,
    @Args('toAddress', { type: () => String }) toAddress: string,
    @Args('fromLat', { type: () => Int, nullable: true }) fromLat?: number,
    @Args('fromLng', { type: () => Int, nullable: true }) fromLng?: number,
    @Args('toLat', { type: () => Int, nullable: true }) toLat?: number,
    @Args('toLng', { type: () => Int, nullable: true }) toLng?: number,
    @Args('paymentMethod', { type: () => String, nullable: true }) paymentMethod?: 'CARD' | 'CASH',
    @Args('stops', { type: () => [String], nullable: true }) stops?: Array<{address: string, lat: number, lng: number}>,
  ) {
    return this.rideService.createRideForPassenger(passengerId, {
      fromAddress,
      toAddress,
      fromLat,
      fromLng,
      toLat,
      toLng,
      paymentMethod,
      stops,
    });
  }
}
