import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AgentAdminService } from './agent-admin.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('agent-admin')
@UseGuards(AuthGuard)
export class AgentAdminController {
  constructor(private readonly agentAdminService: AgentAdminService) {}

  @Get('dashboard')
  getDashboard() {
    return this.agentAdminService.getDashboardData();
  }

  // --- Partner Management ---
  @Get('agents')
  getAgents() {
    return this.agentAdminService.getAgents();
  }

  @Get('partners')
  getPartners() {
    return this.agentAdminService.getAgents();
  }

  @Post('agents')
  createAgent(@Req() req: any, @Body() dto: any) {
    const adminId = req.user?.id || 'system';
    const adminName = req.user?.name || 'Agent Admin';
    return this.agentAdminService.createAgent(dto, adminId, adminName);
  }

  @Post('partners')
  createPartner(@Req() req: any, @Body() dto: any) {
    const adminId = req.user?.id || 'system';
    const adminName = req.user?.name || 'Agent Admin';
    return this.agentAdminService.createAgent(dto, adminId, adminName);
  }

  @Patch('agents/:id/status')
  updateAgentStatus(@Req() req: any, @Param('id') id: string, @Body('status') status: string) {
    const adminId = req.user?.id || 'system';
    const adminName = req.user?.name || 'Agent Admin';
    return this.agentAdminService.updateAgentStatus(id, status, adminId, adminName);
  }

  // --- Chapter 4: Partner-Course Pricing ---
  @Get('pricing')
  getPricing() {
    return this.agentAdminService.getPricing();
  }

  @Post('pricing')
  setPricing(@Req() req: any, @Body() dto: any) {
    const adminId = req.user?.id || 'system';
    const adminName = req.user?.name || 'Agent Admin';
    return this.agentAdminService.setPricing(dto, adminId, adminName);
  }

  @Delete('pricing/:id')
  deletePricing(@Req() req: any, @Param('id') id: string) {
    const adminId = req.user?.id || 'system';
    const adminName = req.user?.name || 'Agent Admin';
    return this.agentAdminService.deletePricing(id, adminId, adminName);
  }

  // --- Chapter 3, 5 & 8: Purchases Ledger ---
  @Get('purchases')
  getPurchases(@Query() query: any) {
    return this.agentAdminService.getPurchases(query);
  }

  // --- Chapter 5: Settlements Verification ---
  @Get('settlements')
  getSettlements() {
    return this.agentAdminService.getSettlements();
  }

  @Patch('settlements/:id/verify')
  verifySettlement(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    const adminId = req.user?.id || 'system';
    const adminName = req.user?.name || 'Agent Admin';
    return this.agentAdminService.verifySettlement(id, dto, adminId, adminName);
  }

  @Patch('settlements/:id/reject')
  rejectSettlement(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    const adminId = req.user?.id || 'system';
    const adminName = req.user?.name || 'Agent Admin';
    return this.agentAdminService.rejectSettlement(id, dto, adminId, adminName);
  }

  @Patch('settlements/:id/pay')
  paySettlement(@Req() req: any, @Param('id') id: string) {
    const adminId = req.user?.id || 'system';
    const adminName = req.user?.name || 'Agent Admin';
    return this.agentAdminService.verifySettlement(id, {}, adminId, adminName);
  }

  // --- Seafarer Masters & Audit Logs ---
  @Get('seafarers')
  getReferredSeafarers() {
    return this.agentAdminService.getReferredSeafarers();
  }

  @Get('audit-logs')
  getAuditLogs() {
    return this.agentAdminService.getAuditLogs();
  }

  // --- Legacy Compatibility Endpoints ---
  @Patch('agents/:id/commission')
  updateAgentCommission(
    @Req() req: any,
    @Param('id') id: string,
    @Body('generalCommission') generalCommission: number,
    @Body('courseCommissions') courseCommissions: Record<string, number>,
  ) {
    const adminId = req.user?.id || 'system';
    const adminName = req.user?.name || 'Agent Admin';
    return this.agentAdminService.updateAgentCommission(
      id,
      generalCommission,
      courseCommissions,
      adminId,
      adminName,
    );
  }

  @Post('agents/:id/reset-password')
  resetAgentPassword(@Req() req: any, @Param('id') id: string, @Body() passwordDto: any) {
    const adminId = req.user?.id || 'system';
    const adminName = req.user?.name || 'Agent Admin';
    return this.agentAdminService.resetAgentPassword(id, passwordDto, adminId, adminName);
  }

  @Get('agents/:id/onboarding')
  getAgentOnboarding(@Param('id') id: string) {
    return this.agentAdminService.getAgentOnboarding(id);
  }

  @Get('referral-leads')
  getReferralLeads() {
    return this.agentAdminService.getReferralLeads();
  }

  @Get('commissions')
  getCommissions() {
    return this.agentAdminService.getCommissions();
  }

  @Get('reports')
  getReports() {
    return this.agentAdminService.getReports();
  }

  @Patch('agents/:id')
  updateAgentDetails(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    const adminId = req.user?.id || 'system';
    const adminName = req.user?.name || 'Agent Admin';
    return this.agentAdminService.updateAgentDetails(id, dto, adminId, adminName);
  }

  @Patch('agents/:id/verify-document')
  verifyAgentDocument(
    @Req() req: any,
    @Param('id') id: string,
    @Body('docId') docId: string,
    @Body('status') status: string,
    @Body('remarks') remarks: string,
  ) {
    const adminId = req.user?.id || 'system';
    const adminName = req.user?.name || 'Agent Admin';
    return this.agentAdminService.verifyAgentDocument(id, docId, status, remarks, adminId, adminName);
  }

  @Get('referral-conflicts')
  getReferralConflicts() {
    return this.agentAdminService.getReferralConflicts();
  }

  @Post('resolve-conflict')
  resolveConflict(
    @Req() req: any,
    @Body('purchaseId') purchaseId: string,
    @Body('approvedAgentId') approvedAgentId: string,
    @Body('remarks') remarks: string,
  ) {
    const adminId = req.user?.id || 'system';
    const adminName = req.user?.name || 'Agent Admin';
    return this.agentAdminService.resolveConflict(purchaseId, approvedAgentId, remarks, adminId, adminName);
  }

  @Patch('commissions/:id/status')
  updateCommissionStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('reason') reason: string,
  ) {
    const adminId = req.user?.id || 'system';
    const adminName = req.user?.name || 'Agent Admin';
    return this.agentAdminService.updateCommissionStatus(id, status, reason, adminId, adminName);
  }

  @Get('commissions/:id/history')
  getCommissionStatusHistory(@Param('id') id: string) {
    return this.agentAdminService.getCommissionStatusHistory(id);
  }

  @Post('settlements')
  createSettlementBatch(@Req() req: any, @Body() dto: any) {
    const adminId = req.user?.id || 'system';
    const adminName = req.user?.name || 'Agent Admin';
    return this.agentAdminService.createSettlementBatch(dto, adminId, adminName);
  }
}
