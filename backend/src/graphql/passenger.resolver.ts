import { Resolver, Query, Args } from '@nestjs/graphql';
import { PassengerProfile } from '@prisma/client';

@Resolver(() => PassengerProfile)
export class PassengerResolver {
  @Query(() => PassengerProfile, { name: 'passenger', nullable: true })
  async getPassenger(@Args('id', { type: () => String }) id: string) {
    // This would need to be implemented with actual passenger service
    return null;
  }
}
