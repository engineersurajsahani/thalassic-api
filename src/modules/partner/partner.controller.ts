import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PartnerService } from './partner.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ROLES } from '../../common/decorators/roles.decorator';

@Controller(['partner', 'agent'])
@UseGuards(AuthGuard, RolesGuard)
@Roles(ROLES.PARTNER_ADMIN, ROLES.AGENT_ADMIN, ROLES.AGENT, ROLES.MASTER)
export class PartnerController {
  constructor(private readonly partnerService: PartnerService) {}

  @Get('dashboard')
  getDashboard(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.partnerService.getDashboard(userId);
  }

  @Get('metadata')
  getMetadata(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.partnerService.getMetadata(userId);
  }

  @Put('profile')
  updateProfile(@Req() req: any, @Body() data: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.partnerService.updateProfile(userId, data);
  }

  @Get('profile')
  getProfile(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.partnerService.getMetadata(userId);
  }

  @Get(['referral-leads', 'leads'])
  getReferrals(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.partnerService.getReferrals(userId);
  }

  @Post(['referral-leads', 'leads'])
  createReferral(@Req() req: any, @Body() data: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.partnerService.createReferral(userId, data);
  }

  @Put(['referral-leads/:id', 'leads/:id'])
  updateReferral(@Req() req: any, @Param('id') id: string, @Body() data: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.partnerService.updateReferral(userId, id, data);
  }

  @Get(['payables', 'commissions', 'purchases'])
  getPayables(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.partnerService.getPayables(userId);
  }

  @Get('settlements')
  getSettlements(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.partnerService.getSettlements(userId);
  }

  @Post('settlements/request')
  requestSettlement(
    @Req() req: any,
    @Body('payableIds') payableIds?: string[],
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.partnerService.requestSettlement(userId, payableIds);
  }

  @Get('documents')
  getDocuments(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.partnerService.getDocuments(userId);
  }

  @Post('documents')
  uploadDocument(@Req() req: any, @Body() data: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.partnerService.uploadDocument(userId, data);
  }

  @Get('support-tickets')
  getSupportTickets(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.partnerService.getSupportTickets(userId);
  }

  @Post('support-tickets')
  createSupportTicket(@Req() req: any, @Body() data: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.partnerService.createSupportTicket(userId, data);
  }

  @Post('support-tickets/:id/reply')
  replySupportTicket(
    @Req() req: any,
    @Param('id') ticketId: string,
    @Body('message') message: string,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.partnerService.replySupportTicket(userId, ticketId, message);
  }

  @Get('notifications')
  getNotifications(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.partnerService.getNotifications(userId);
  }

  @Patch('notifications/:id/read')
  markNotificationRead(@Param('id') id: string) {
    return this.partnerService.markNotificationRead(id);
  }
}
