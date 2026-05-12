import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IntercityTripsService } from './intercity-trips.service';

@Controller('intercity-bookings')
export class IntercityBookingsController {
  constructor(private readonly intercityTripsService: IntercityTripsService) {}

  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  listMine(@Req() req: any) {
    return this.intercityTripsService.listBookingsForPassenger(req.user.userId);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  getById(@Param('id') id: string, @Req() req: any) {
    return this.intercityTripsService.getBookingForPassenger(req.user.userId, id);
  }
}
