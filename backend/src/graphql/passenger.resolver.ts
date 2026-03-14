import { Resolver, Query, Args } from '@nestjs/graphql';

@Resolver()
export class PassengerResolver {
  @Query(() => String, { name: 'passenger', nullable: true })
  async getPassenger(@Args('id', { type: () => String }) id: string) {
    return null;
  }
}