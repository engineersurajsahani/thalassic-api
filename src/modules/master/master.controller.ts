import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { MasterService } from './master.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('master')
@UseGuards(AuthGuard)
export class MasterController {
  constructor(private readonly masterService: MasterService) {}

  // --- 1. Dashboard API ---
  @Get('dashboard')
  getDashboard() {
    return this.masterService.getDashboardData();
  }

  @Get('reports')
  getReports(@Query('days') days?: string) {
    return this.masterService.getReportsData(days);
  }

  // --- 2. Course Management APIs ---
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

  // --- 3. User Management APIs ---
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

  // --- 4. Settings APIs ---
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
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, secret) as any;
    const adminId = decoded.sub;
    return this.masterService.updateAdminProfile(adminId, dto);
  }

  // --- 5. Finance Module APIs (Master Only) ---

  private verifyMasterRole(req: any) {
    if (!req.user || req.user.role !== 'MASTER') {
      throw new ForbiddenException('Access denied. Master role required.');
    }
  }

  @Get('finance/payments')
  getPayments(@Req() req: any, @Query() query: any) {
    this.verifyMasterRole(req);
    return this.masterService.getPayments(query);
  }

  @Get('finance/invoices')
  getInvoices(@Req() req: any, @Query() query: any) {
    this.verifyMasterRole(req);
    return this.masterService.getInvoices(req.user, query);
  }

  @Get('finance/invoices/:id/pdf')
  getInvoicePdf(@Req() req: any, @Param('id') id: string) {
    this.verifyMasterRole(req);
    return this.masterService.getInvoicePdf(id, req.user);
  }

  @Post('finance/invoices/:id/resend')
  resendInvoice(@Req() req: any, @Param('id') id: string) {
    this.verifyMasterRole(req);
    return this.masterService.resendInvoice(id, req.user);
  }

  @Get('finance/commissions')
  getCommissions(@Req() req: any) {
    this.verifyMasterRole(req);
    return this.masterService.getCommissionsOverview();
  }

  @Get('finance/settlements')
  getSettlements(@Req() req: any) {
    this.verifyMasterRole(req);
    return this.masterService.getSettlements();
  }

  @Post('finance/settlements/:id/approve')
  approveSettlement(@Req() req: any, @Param('id') id: string) {
    this.verifyMasterRole(req);
    const adminId = req.user?.id || 'system';
    const adminName = req.user?.name || 'Master Admin';
    return this.masterService.approveSettlement(id, adminId, adminName);
  }

  @Post('finance/settlements/:id/pay')
  paySettlement(@Req() req: any, @Param('id') id: string) {
    this.verifyMasterRole(req);
    const adminId = req.user?.id || 'system';
    const adminName = req.user?.name || 'Master Admin';
    return this.masterService.paySettlement(id, adminId, adminName);
  }
}
