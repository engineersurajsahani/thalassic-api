import { Injectable } from '@nestjs/common';
import { FinanceReportsService } from './finance-reports.service';
import { FinanceAuditService } from './finance-audit.service';
import { FinanceExportService } from './finance-export.service';
import {
  ReportQueryDto,
  ExportReportDto,
  AuditLogQueryDto,
  CreateFinancialAuditLogDto,
} from './dto/finance.dto';

@Injectable()
export class FinanceService {
  constructor(
    private readonly reportsService: FinanceReportsService,
    private readonly auditService: FinanceAuditService,
    private readonly exportService: FinanceExportService,
  ) {}

  // --- Executive Dashboard Overview ---
  async getOverview() {
    return this.reportsService.getFinanceOverview();
  }

  // --- Revenue Reports ---
  async getDailyRevenue(query: ReportQueryDto) {
    return this.reportsService.getDailyRevenueReport(query);
  }

  async getMonthlyRevenue(query: ReportQueryDto) {
    return this.reportsService.getMonthlyRevenueReport(query);
  }

  async getAnnualRevenue(query: ReportQueryDto) {
    return this.reportsService.getAnnualRevenueReport(query);
  }

  async getConsolidatedRevenue(query: ReportQueryDto) {
    return this.reportsService.getConsolidatedRevenueReport(query);
  }

  // --- Payment Reports ---
  async getSuccessfulPayments(query: ReportQueryDto) {
    return this.reportsService.getSuccessfulPaymentsReport(query);
  }

  async getFailedPayments(query: ReportQueryDto) {
    return this.reportsService.getFailedPaymentsReport(query);
  }

  async getPendingPayments(query: ReportQueryDto) {
    return this.reportsService.getPendingPaymentsReport(query);
  }

  async getConsolidatedPayments(query: ReportQueryDto) {
    return this.reportsService.getConsolidatedPaymentsReport(query);
  }

  // --- Commission Reports ---
  async getPendingCommissions(query: ReportQueryDto) {
    return this.reportsService.getPendingCommissionsReport(query);
  }

  async getPaidCommissions(query: ReportQueryDto) {
    return this.reportsService.getPaidCommissionsReport(query);
  }

  async getOutstandingCommissions(query: ReportQueryDto) {
    return this.reportsService.getOutstandingCommissionsReport(query);
  }

  async getConsolidatedCommissions(query: ReportQueryDto) {
    return this.reportsService.getConsolidatedCommissionsReport(query);
  }

  // --- Invoice Reports ---
  async getHocInvoices(query: ReportQueryDto) {
    return this.reportsService.getHocInvoicesReport(query);
  }

  async getHacInvoices(query: ReportQueryDto) {
    return this.reportsService.getHacInvoicesReport(query);
  }

  async getInvoiceSummary(query: ReportQueryDto) {
    return this.reportsService.getInvoiceSummaryReport(query);
  }

  async getConsolidatedInvoices(query: ReportQueryDto) {
    return this.reportsService.getConsolidatedInvoicesReport(query);
  }

  // --- Settlement Reports ---
  async getPendingSettlements(query: ReportQueryDto) {
    return this.reportsService.getPendingSettlementsReport(query);
  }

  async getPaidSettlements(query: ReportQueryDto) {
    return this.reportsService.getPaidSettlementsReport(query);
  }

  async getSettlementHistory(query: ReportQueryDto) {
    return this.reportsService.getSettlementHistoryReport(query);
  }

  async getConsolidatedSettlements(query: ReportQueryDto) {
    return this.reportsService.getConsolidatedSettlementsReport(query);
  }

  // --- Multi-Format Report Export ---
  async exportReport(
    dto: ExportReportDto,
    user: { id?: string; name?: string; email?: string },
    ipAddress?: string,
  ) {
    return this.exportService.exportReport(dto, user, ipAddress);
  }

  // --- Financial Audit Logs ---
  async getAuditLogs(query: AuditLogQueryDto) {
    return this.auditService.getAuditLogs(query);
  }

  async getAuditLogById(id: string) {
    return this.auditService.getAuditLogById(id);
  }

  async logFinancialActivity(
    dto: CreateFinancialAuditLogDto,
    user: { id?: string; name?: string; email?: string },
  ) {
    return this.auditService.logFinancialActivity({
      userId: user?.id,
      userName: user?.name,
      action: dto.action,
      module: dto.module,
      entityId: dto.entityId,
      details: dto.details || '',
      previousValue: dto.previousValue,
      updatedValue: dto.updatedValue,
      ipAddress: dto.ipAddress,
    });
  }

  // Section 7.8 Immutability Enforcement
  updateAuditLog() {
    return this.auditService.updateAuditLog();
  }

  deleteAuditLog() {
    return this.auditService.deleteAuditLog();
  }
}
