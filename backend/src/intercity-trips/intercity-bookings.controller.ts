import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '@prisma/client/index';
import { IntercityTripsService } from './intercity-trips.service';

@Controller('intercity-bookings')
export class IntercityBookingsController {
  constructor(private readonly intercityTripsService: IntercityTripsService) {}

  @Get('my')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.PASSENGER)
  listMine(@Req() req: any) {
    return this.intercityTripsService.listBookingsForPassenger(req.user.userId);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.PASSENGER)
  getById(@Param('id') id: string, @Req() req: any) {
    return this.intercityTripsService.getBookingForPassenger(req.user.userId, id);
  }
}
