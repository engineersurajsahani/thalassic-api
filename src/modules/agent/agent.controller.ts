import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { AgentService } from './agent.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller(['agent', 'partner'])
@UseGuards(AuthGuard)
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  private checkRole(req: any) {
    const role = (req.user?.role || '').toUpperCase();
    if (role !== 'AGENT' && role !== 'PARTNER') {
      throw new ForbiddenException('Access restricted to Authorized Partners.');
    }
  }

  // --- Dashboard & Metrics ---
  @Get('dashboard')
  getDashboard(@Req() req: any) {
    this.checkRole(req);
    return this.agentService.getDashboard(req.user.id);
  }

  // --- Seafarer Master Identity & Search ---
  @Get('seafarers/search')
  searchSeafarers(@Req() req: any, @Query('q') query?: string) {
    this.checkRole(req);
    return this.agentService.searchSeafarers(query);
  }

  @Get('seafarers')
  getSeafarers(@Req() req: any, @Query('q') query?: string) {
    this.checkRole(req);
    return this.agentService.searchSeafarers(query);
  }

  @Post('seafarers')
  createSeafarer(@Req() req: any, @Body() dto: any) {
    this.checkRole(req);
    return this.agentService.createSeafarer(req.user.id, dto);
  }

  @Get('seafarers/:id')
  getSeafarerById(@Req() req: any, @Param('id') id: string) {
    this.checkRole(req);
    return this.agentService.getSeafarerById(req.user.id, id);
  }

  // --- Courses & Partner Pricing ---
  @Get('courses')
  getCourses(@Req() req: any) {
    this.checkRole(req);
    return this.agentService.getCourses(req.user.id);
  }

  @Get('pricing/:courseId')
  getPricing(@Req() req: any, @Param('courseId') courseId: string) {
    this.checkRole(req);
    return this.agentService.getPricing(req.user.id, courseId);
  }

  // --- Purchases & Physical Enrollment ---
  @Post('purchases')
  createPurchase(@Req() req: any, @Body() dto: any) {
    this.checkRole(req);
    return this.agentService.createPurchase(req.user.id, dto);
  }

  @Get('purchases')
  getPurchases(@Req() req: any) {
    this.checkRole(req);
    return this.agentService.getPurchases(req.user.id);
  }

  @Get('purchases/:id')
  getPurchaseById(@Req() req: any, @Param('id') id: string) {
    this.checkRole(req);
    return this.agentService.getPurchaseById(req.user.id, id);
  }

  // --- Partner Financials & Settlements ---
  @Get('financials')
  getFinancials(@Req() req: any) {
    this.checkRole(req);
    return this.agentService.getFinancials(req.user.id);
  }

  @Post('settlements')
  submitSettlement(@Req() req: any, @Body() dto: any) {
    this.checkRole(req);
    return this.agentService.submitSettlement(req.user.id, dto);
  }

  @Get('settlements')
  getSettlements(@Req() req: any) {
    this.checkRole(req);
    return this.agentService.getSettlements(req.user.id);
  }

  @Get('settlements/:id')
  getSettlementById(@Req() req: any, @Param('id') id: string) {
    this.checkRole(req);
    return this.agentService.getSettlementById(req.user.id, id);
  }

  // --- Partner Profile & Verification Documents ---
  @Get('metadata')
  getMetadata(@Req() req: any) {
    this.checkRole(req);
    return this.agentService.getMetadata(req.user.id);
  }

  @Post('onboard')
  onboard(@Req() req: any, @Body() dto: any) {
    this.checkRole(req);
    return this.agentService.onboard(req.user.id, dto);
  }

  @Get('documents')
  getDocuments(@Req() req: any) {
    this.checkRole(req);
    return this.agentService.getDocuments(req.user.id);
  }

  @Post('documents')
  uploadDocument(
    @Req() req: any,
    @Body('type') type: string,
    @Body('expiryDate') expiryDate?: string,
    @Body('fileName') fileName?: string,
  ) {
    this.checkRole(req);
    return this.agentService.uploadDocument(req.user.id, type, expiryDate, fileName);
  }

  @Get('profile')
  getProfile(@Req() req: any) {
    this.checkRole(req);
    return this.agentService.getProfile(req.user.id);
  }

  @Put('profile')
  updateProfile(@Req() req: any, @Body() dto: any) {
    this.checkRole(req);
    return this.agentService.updateProfile(req.user.id, dto);
  }

  @Get('support')
  getSupportTickets(@Req() req: any) {
    this.checkRole(req);
    return this.agentService.getSupportTickets(req.user.id);
  }

  @Get('support/:id')
  getSupportTicketById(@Req() req: any, @Param('id') id: string) {
    this.checkRole(req);
    return this.agentService.getSupportTicketById(req.user.id, id);
  }

  @Post('support')
  createSupportTicket(@Req() req: any, @Body() dto: any) {
    this.checkRole(req);
    return this.agentService.createSupportTicket(req.user.id, dto);
  }

  @Get('invoices')
  getInvoices(@Req() req: any) {
    this.checkRole(req);
    return this.agentService.getInvoices(req.user.id);
  }

  @Get('notifications')
  getNotifications(@Req() req: any) {
    this.checkRole(req);
    return this.agentService.getNotifications(req.user.id);
  }

  @Patch('notifications/:id/read')
  markNotificationRead(@Req() req: any, @Param('id') id: string) {
    this.checkRole(req);
    return this.agentService.markNotificationRead(req.user.id, id);
  }

  @Delete('notifications/:id')
  deleteNotification(@Req() req: any, @Param('id') id: string) {
    this.checkRole(req);
    return this.agentService.deleteNotification(req.user.id, id);
  }

  @Put('settings/password')
  changePassword(@Req() req: any, @Body() dto: any) {
    this.checkRole(req);
    return this.agentService.changePassword(req.user.id, dto.oldPassword, dto.newPassword);
  }

  // Legacy Leads and Commissions aliases
  @Get('leads')
  getLeads(@Req() req: any) {
    this.checkRole(req);
    return this.agentService.getLeads(req.user.id);
  }

  @Post('leads')
  createLead(@Req() req: any, @Body() dto: any) {
    this.checkRole(req);
    return this.agentService.createLead(req.user.id, dto);
  }

  @Get('leads/:id')
  getLeadById(@Req() req: any, @Param('id') id: string) {
    this.checkRole(req);
    return this.agentService.getLeadById(req.user.id, id);
  }

  @Patch('leads/:id')
  updateLead(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    this.checkRole(req);
    return this.agentService.updateLead(req.user.id, id, dto);
  }

  @Get('commissions')
  getCommissions(@Req() req: any) {
    this.checkRole(req);
    return this.agentService.getCommissions(req.user.id);
  }
}
