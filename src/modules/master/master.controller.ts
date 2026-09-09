import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { MasterService } from './master.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ROLES } from '../../common/decorators/roles.decorator';

@Controller('master')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ROLES.MASTER)
export class MasterController {
  constructor(private readonly masterService: MasterService) {}

  // =========================================================================
  // 1. Dashboard Metrics & Analytics (PRD Chapter 1.3 & Handwritten Notes Item 4)
  // =========================================================================
  @Get('dashboard')
  getDashboard() {
    return this.masterService.getDashboardData();
  }

  // =========================================================================
  // 2. Seafarer Management & Master Records (PRD Chapter 1.4, 1.5 & Notes Item 2)
  // =========================================================================
  @Get('seafarers')
  getSeafarers(@Query() query: any) {
    return this.masterService.getSeafarers(query);
  }

  @Get('seafarers/:id')
  getSeafarerMasterRecord(@Param('id') id: string) {
    return this.masterService.getSeafarerMasterRecord(id);
  }

  @Patch('seafarers/:id')
  updateSeafarer(@Param('id') id: string, @Body() dto: any) {
    return this.masterService.updateSeafarer(id, dto);
  }

  @Get('seafarers/:id/documents')
  getSeafarerDocuments(@Param('id') id: string) {
    return this.masterService.getSeafarerDocuments(id);
  }

  @Post('seafarers/:id/documents/:docId/verify')
  verifySeafarerDocument(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Body() body: { status: 'Verified' | 'Rejected'; remarks?: string },
  ) {
    return this.masterService.verifySeafarerDocument(
      id,
      docId,
      body.status,
      body.remarks,
    );
  }

  // =========================================================================
  // 3. Admin Management (Handwritten Notes Item 1)
  // =========================================================================
  @Get('admins')
  getAdmins(@Query('type') type?: string) {
    return this.masterService.getAdmins(type);
  }

  @Post('admins')
  createAdmin(
    @Body()
    dto: {
      name: string;
      email: string;
      phone?: string;
      password: string;
      adminType: 'company_admin' | 'agent_admin';
    },
  ) {
    return this.masterService.createAdmin(dto);
  }

  @Patch('admins/:id')
  updateAdmin(@Param('id') id: string, @Body() dto: any) {
    return this.masterService.updateAdmin(id, dto);
  }

  @Patch('admins/:id/status')
  toggleAdminStatus(
    @Param('id') id: string,
    @Body('status') status: 'Active' | 'Inactive',
  ) {
    return this.masterService.toggleAdminStatus(id, status);
  }

  @Post('admins/:id/reset-password')
  resetAdminPassword(
    @Param('id') id: string,
    @Body('newPassword') newPass?: string,
  ) {
    return this.masterService.resetAdminPassword(id, newPass);
  }

  // =========================================================================
  // 4. Partner Management & Course Pricing (Handwritten Notes Items 5 & 6)
  // =========================================================================
  @Get('partners')
  getPartners(@Query() query: any) {
    return this.masterService.getPartners(query);
  }

  @Get('partners/:id')
  getPartnerDetails(@Param('id') id: string) {
    return this.masterService.getPartnerDetails(id);
  }

  @Patch('partners/:id')
  updatePartner(@Param('id') id: string, @Body() dto: any) {
    return this.masterService.updatePartner(id, dto);
  }

  @Patch('partners/:id/pricing')
  updatePartnerPricing(
    @Param('id') id: string,
    @Body()
    dto: {
      courseId: string;
      payableToHariOm: number;
      suggestedSelling?: number;
      tier?: string;
    },
  ) {
    return this.masterService.updatePartnerPricing(id, dto);
  }

  @Get('partners/:id/settlements')
  getPartnerSettlements(@Param('id') id: string) {
    return this.masterService.getPartnerSettlements(id);
  }

  // =========================================================================
  // 5. Institute Management (PRD Chapter 1.2 & Handwritten Notes Item 4)
  // =========================================================================
  @Get('institutes')
  getInstitutes() {
    return this.masterService.getInstitutes();
  }

  @Post('institutes')
  createInstitute(@Body() dto: any) {
    return this.masterService.createInstitute(dto);
  }

  @Patch('institutes/:id')
  updateInstitute(@Param('id') id: string, @Body() dto: any) {
    return this.masterService.updateInstitute(id, dto);
  }

  @Get('institutes/:id/batches')
  getInstituteBatches(@Param('id') id: string) {
    return this.masterService.getInstituteBatches(id);
  }

  // =========================================================================
  // 6. Course Management (PRD Chapter 1.2 & Handwritten Notes Item 6)
  // =========================================================================
  @Get('courses')
  getCourses() {
    return this.masterService.getCourses();
  }

  @Post('courses')
  createCourse(@Body() dto: any) {
    return this.masterService.createCourse(dto);
  }

  @Patch('courses/:id')
  updateCourse(@Param('id') id: string, @Body() dto: any) {
    return this.masterService.updateCourse(id, dto);
  }

  @Delete('courses/:id')
  deleteCourse(@Param('id') id: string) {
    return this.masterService.deleteCourse(id);
  }

  @Patch('courses/:id/commission')
  setCourseCommission(
    @Param('id') id: string,
    @Body('commissionPercentage') commissionPercentage: number,
  ) {
    return this.masterService.setCourseCommission(id, commissionPercentage);
  }

  // =========================================================================
  // 7. Finance & Settlements (PRD Chapter 1.2 & Handwritten Notes Item 8)
  // =========================================================================
  @Get('finance/overview')
  getFinanceOverview() {
    return this.masterService.getFinanceOverview();
  }

  @Get('finance/payments')
  getPayments(@Req() req: any, @Query() query: any) {
    return this.masterService.getPayments(query);
  }

  @Get('finance/invoices')
  getInvoices(@Req() req: any, @Query() query: any) {
    return this.masterService.getInvoices(req.user, query);
  }

  @Get('finance/invoices/:id/pdf')
  getInvoicePdf(@Req() req: any, @Param('id') id: string) {
    return this.masterService.getInvoicePdf(id, req.user);
  }

  @Post('finance/invoices/:id/resend')
  resendInvoice(@Req() req: any, @Param('id') id: string) {
    return this.masterService.resendInvoice(id, req.user);
  }

  @Get('finance/commissions')
  getCommissions(@Req() req: any) {
    return this.masterService.getCommissionsOverview();
  }

  @Get('finance/settlements')
  getSettlements(@Req() req: any) {
    return this.masterService.getSettlements();
  }

  @Post('finance/settlements/:id/approve')
  approveSettlement(@Req() req: any, @Param('id') id: string) {
    const adminId = req.user?.id || 'system';
    const adminName = req.user?.name || 'Master Admin';
    return this.masterService.approveSettlement(id, adminId, adminName);
  }

  @Post('finance/settlements/:id/pay')
  paySettlement(@Req() req: any, @Param('id') id: string) {
    const adminId = req.user?.id || 'system';
    const adminName = req.user?.name || 'Master Admin';
    return this.masterService.paySettlement(id, adminId, adminName);
  }

  // =========================================================================
  // 8. Reports & Analytics (Handwritten Notes Item 9)
  // =========================================================================
  @Get('reports')
  getReports(@Query('days') days?: string) {
    return this.masterService.getReportsData(days);
  }

  @Get('reports/courses-sold')
  getCoursesSoldMore() {
    return this.masterService.getCoursesSoldMore();
  }

  @Get('reports/course-progress')
  getCourseProgress(@Query() query: any) {
    return this.masterService.getCourseProgress(query);
  }

  @Get('reports/commissions')
  getCommissionReports(@Query() query: any) {
    return this.masterService.getCommissionReports(query);
  }

  // =========================================================================
  // 9. Verification & Leads (Handwritten Notes Items 7 & 8)
  // =========================================================================
  @Get('verification')
  getVerificationQueue(@Query() query: any) {
    return this.masterService.getVerificationQueue(query);
  }

  @Post('verification/whatsapp-notify')
  sendWhatsAppNotification(
    @Body()
    dto: {
      recipientPhone: string;
      recipientName: string;
      template: string;
      customMessage?: string;
      documentType?: string;
    },
  ) {
    return this.masterService.sendWhatsAppNotification(dto);
  }

  @Get('leads')
  getLeads(@Query() query: any) {
    return this.masterService.getLeads(query);
  }

  // =========================================================================
  // 10. Settings & Master Account Security (Handwritten Notes Item 10)
  // =========================================================================
  @Get('settings')
  getSettings() {
    return this.masterService.getSettings();
  }

  @Patch('settings')
  updateSettings(@Body() dto: any) {
    return this.masterService.updateSettings(dto);
  }

  @Patch('profile')
  updateProfile(@Req() req: any, @Body() dto: any) {
    const adminId = req.user?.id || req.user?.sub;
    return this.masterService.updateAdminProfile(adminId, dto);
  }

  @Post('settings/change-password')
  changePassword(
    @Req() req: any,
    @Body() dto: { currentPassword?: string; newPassword?: string },
  ) {
    const adminId =
      req.user?.id || req.user?.sub || 'a0000000-0000-0000-0000-000000000000';
    return this.masterService.changePassword(
      adminId,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  // Backward compatibility alias endpoints
  @Get('users')
  getUsers(@Query('role') role?: string) {
    return this.masterService.getUsers(role);
  }

  @Post('users')
  createUser(@Body() dto: any) {
    return this.masterService.createUser(dto);
  }

  @Get('users/:id/profile')
  getUserProfile(@Param('id') id: string) {
    return this.masterService.getUserProfile(id);
  }

  @Patch('users/:id/status')
  updateUserStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.masterService.updateUserStatus(id, status);
  }
}
