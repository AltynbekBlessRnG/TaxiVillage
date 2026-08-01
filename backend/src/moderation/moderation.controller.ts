import { Body, Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ModerationService } from './moderation.service';

class BlockUserDto {
  @IsString()
  blockedUserId!: string;
}

class ReportMessageDto {
  @IsString()
  messageId!: string;

  @IsString()
  @MaxLength(120)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  context?: string;
}

@Controller('moderation')
@UseGuards(AuthGuard('jwt'))
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get('blocked')
  getBlocked(@Req() req: any) {
    return this.moderationService.getBlockedUserIds(req.user.userId);
  }

  @Post('block')
  block(@Req() req: any, @Body() dto: BlockUserDto) {
    return this.moderationService.blockUser(req.user.userId, dto.blockedUserId);
  }

  @Delete('block')
  unblock(@Req() req: any, @Body() dto: BlockUserDto) {
    return this.moderationService.unblockUser(req.user.userId, dto.blockedUserId);
  }

  @Post('report')
  report(@Req() req: any, @Body() dto: ReportMessageDto) {
    return this.moderationService.reportMessage(req.user.userId, dto);
  }
}
