import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
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

  @Get('agents')
  getAgents() {
    return this.agentAdminService.getAgents();
  }

  @Post('agents')
  createAgent(@Req() req: any, @Body() dto: any) {
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

  @Get('seafarers')
  getReferredSeafarers() {
    return this.agentAdminService.getReferredSeafarers();
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

  @Get('audit-logs')
  getAuditLogs() {
    return this.agentAdminService.getAuditLogs();
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

  // --- Commission Lifecycle & Settlement Endpoints ---
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

  @Get('settlements')
  getSettlements() {
    return this.agentAdminService.getSettlements();
  }

  @Patch('settlements/:id/pay')
  paySettlement(@Req() req: any, @Param('id') id: string) {
    const adminId = req.user?.id || 'system';
    const adminName = req.user?.name || 'Agent Admin';
    return this.agentAdminService.paySettlement(id, adminId, adminName);
  }

  @Patch('settlements/:id/status')
  updateSettlementStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    const adminId = req.user?.id || 'system';
    const adminName = req.user?.name || 'Agent Admin';
    return this.agentAdminService.updateSettlementStatus(id, status, adminId, adminName);
  }

  @Get('tickets')
  getTickets() {
    return this.agentAdminService.getTickets();
  }

  @Post('tickets/:id/reply')
  addTicketReply(
    @Req() req: any,
    @Param('id') id: string,
    @Body('message') message: string,
  ) {
    const adminId = req.user?.id || 'system';
    const adminName = req.user?.name || 'Agent Admin';
    return this.agentAdminService.addTicketReply(id, message, adminId, adminName);
  }

  @Patch('tickets/:id/status')
  updateTicketStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    const adminId = req.user?.id || 'system';
    const adminName = req.user?.name || 'Agent Admin';
    return this.agentAdminService.updateTicketStatus(id, status, adminId, adminName);
  }
}
