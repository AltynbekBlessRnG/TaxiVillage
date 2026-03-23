import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '@prisma/client/index';
import { IntercityDriversService } from './intercity-drivers.service';

class SetStatusDto {
  @IsBoolean()
  isOnline!: boolean;
}

@Controller('intercity-drivers')
export class IntercityDriversController {
  constructor(private readonly intercityDriversService: IntercityDriversService) {}

  @Get('public')
  listPublic() {
    return this.intercityDriversService.listPublicDrivers();
  }

  @Post('status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER_INTERCITY)
  setStatus(@Body() dto: SetStatusDto, @Req() req: any) {
    return this.intercityDriversService.setOnlineStatus(req.user.userId, dto.isOnline);
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER_INTERCITY)
  getProfile(@Req() req: any) {
    return this.intercityDriversService.getProfile(req.user.userId);
  }

  @Get('current-order')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DRIVER_INTERCITY)
  currentOrder(@Req() req: any) {
    return this.intercityDriversService.getCurrentOrder(req.user.userId);
  }
}
