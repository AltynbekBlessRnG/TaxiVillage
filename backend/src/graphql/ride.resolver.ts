import { Resolver, Query, Mutation, Args, Float, Int, InputType, Field, ObjectType } from '@nestjs/graphql';
import { RidesService } from '../rides/rides.service';
import { Ride } from '@prisma/client';

@InputType()
class StopInput {
  @Field(() => String)
  address!: string;

  @Field(() => Float)
  lat!: number;

  @Field(() => Float)
  lng!: number;
}

@ObjectType()
class RideType {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  status!: string;

  @Field(() => String, { nullable: true })
  fromAddress?: string;

  @Field(() => String, { nullable: true })
  toAddress?: string;

  @Field(() => Float, { nullable: true })
  fromLat?: number;

  @Field(() => Float, { nullable: true })
  fromLng?: number;

  @Field(() => Float, { nullable: true })
  toLat?: number;

  @Field(() => Float, { nullable: true })
  toLng?: number;

  @Field(() => String, { nullable: true })
  paymentMethod?: string;

  @Field(() => Float, { nullable: true })
  estimatedPrice?: number;

  @Field(() => Float, { nullable: true })
  finalPrice?: number;

  @Field(() => String)
  createdAt!: string;
}

@Resolver(() => RideType)
export class RideResolver {
  constructor(private readonly rideService: RidesService) {}

  @Query(() => [RideType], { name: 'rides' })
  async getRides(@Args('userId', { type: () => String }) userId: string) {
    return this.rideService.getRidesForUser(userId, 'PASSENGER');
  }

  @Query(() => RideType, { name: 'ride', nullable: true })
  async getRide(@Args('id', { type: () => String }) id: string) {
    return this.rideService.getRideById(id);
  }

  @Mutation(() => RideType, { name: 'createRide' })
  async createRide(
    @Args('passengerId', { type: () => String }) passengerId: string,
    @Args('fromAddress', { type: () => String }) fromAddress: string,
    @Args('toAddress', { type: () => String }) toAddress: string,
    @Args('fromLat', { type: () => Float, nullable: true }) fromLat?: number,
    @Args('fromLng', { type: () => Float, nullable: true }) fromLng?: number,
    @Args('toLat', { type: () => Float, nullable: true }) toLat?: number,
    @Args('toLng', { type: () => Float, nullable: true }) toLng?: number,
    @Args('paymentMethod', { type: () => String, nullable: true }) paymentMethod?: 'CARD' | 'CASH',
    @Args('stops', { type: () => [StopInput], nullable: true }) stops?: StopInput[],
  ) {
    return this.rideService.createRideForPassenger(passengerId, {
      fromAddress,
      toAddress,
      fromLat,
      fromLng,
      toLat,
      toLng,
      paymentMethod,
      stops: stops?.map(stop => ({
        address: stop.address,
        lat: stop.lat,
        lng: stop.lng,
      })),
    });
  }
}
