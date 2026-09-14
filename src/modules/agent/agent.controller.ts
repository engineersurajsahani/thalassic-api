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
  UseInterceptors,
  UploadedFile,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AgentService } from './agent.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ROLES } from '../../common/decorators/roles.decorator';

@Controller(['agent', 'partner'])
@UseGuards(AuthGuard, RolesGuard)
@Roles(ROLES.PARTNER, ROLES.PARTNER_ADMIN, ROLES.MASTER)
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  private checkRole(req: any) {
    if (process.env.NODE_ENV !== 'production') return;
    if (
      req.user?.role !== 'PARTNER' &&
      req.user?.role !== 'PARTNER_ADMIN' &&
      req.user?.role !== 'AGENT' &&
      req.user?.role !== 'MASTER'
    ) {
      throw new ForbiddenException('Access restricted to Partners.');
    }
  }

  @Get('dashboard')
  getDashboard(@Req() req: any) {
    this.checkRole(req);
    return this.agentService.getDashboard(req.user.id);
  }

  @Get('financials')
  getFinancials(@Req() req: any) {
    this.checkRole(req);
    return this.agentService.getFinancials(req.user.id);
  }

  @Get('settlements')
  getSettlements(@Req() req: any) {
    this.checkRole(req);
    return this.agentService.getSettlements(req.user.id);
  }

  @Post('settlements')
  submitSettlement(@Req() req: any, @Body() dto: any) {
    this.checkRole(req);
    return this.agentService.submitSettlement(req.user.id, dto);
  }

  @Get('settlements/:id')
  getSettlementById(@Req() req: any, @Param('id') id: string) {
    this.checkRole(req);
    return this.agentService.getSettlementById(req.user.id, id);
  }

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

  @Post('purchases')
  createPurchase(@Req() req: any, @Body() dto: any) {
    this.checkRole(req);
    return this.agentService.createPurchase(req.user.id, dto);
  }

  @Get('courses')
  getCourses(@Req() req: any) {
    this.checkRole(req);
    return this.agentService.getCourses();
  }

  @Get('pricing/:courseId')
  getCoursePricing(@Req() req: any, @Param('courseId') courseId: string) {
    this.checkRole(req);
    return this.agentService.getCoursePricing(courseId);
  }

  @Get('seafarers')
  getSeafarers(@Req() req: any, @Query('q') q?: string) {
    this.checkRole(req);
    return this.agentService.getSeafarers(q);
  }

  @Get('seafarers/search')
  searchSeafarer(@Req() req: any, @Query('q') q: string) {
    this.checkRole(req);
    return this.agentService.searchSeafarer(q);
  }

  @Get('seafarers/:id')
  getSeafarerById(@Req() req: any, @Param('id') id: string) {
    this.checkRole(req);
    return this.agentService.getSeafarerById(id);
  }

  @Post('seafarers')
  createSeafarer(@Req() req: any, @Body() dto: any) {
    this.checkRole(req);
    return this.agentService.createSeafarer(dto);
  }

  @Get('commissions')
  getCommissions(@Req() req: any) {
    this.checkRole(req);
    return this.agentService.getCommissions(req.user.id);
  }

  @Get('documents')
  getDocuments(@Req() req: any) {
    this.checkRole(req);
    return this.agentService.getDocuments(req.user.id);
  }

  @Post('documents')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @Req() req: any,
    @UploadedFile() file: any,
    @Body('type') type: string,
    @Body('expiryDate') expiryDate?: string,
    @Body('documentNumber') documentNumber?: string,
    @Body('placeOfIssue') placeOfIssue?: string,
    @Body('dateOfIssue') dateOfIssue?: string,
  ) {
    this.checkRole(req);
    return this.agentService.uploadDocument(req.user.id, type, file, {
      expiryDate,
      documentNumber,
      placeOfIssue,
      dateOfIssue,
    });
  }

  @Get('documents/:id/download')
  downloadDocument(@Req() req: any, @Param('id') docId: string) {
    this.checkRole(req);
    return this.agentService.downloadDocument(req.user.id, docId);
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
    return this.agentService.changePassword(
      req.user.id,
      dto.oldPassword,
      dto.newPassword,
    );
  }
}
