import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { ExportReportDto } from './dto/finance.dto';
import { FinanceReportsService } from './finance-reports.service';
import { FinanceAuditService } from './finance-audit.service';

@Injectable()
export class FinanceExportService {
  constructor(
    private readonly reportsService: FinanceReportsService,
    private readonly auditService: FinanceAuditService,
  ) {}

  async exportReport(
    dto: ExportReportDto,
    user: { id?: string; name?: string; email?: string },
    ipAddress = '127.0.0.1',
  ): Promise<{
    filename: string;
    contentType: string;
    data: Buffer | string | object;
    rowCount: number;
  }> {
    const { reportType, format, ...filters } = dto;

    let reportTitle = 'Financial Report';
    let records: Record<string, any>[] = [];
    let summary: Record<string, any> = {};

    switch (reportType) {
      case 'revenue_daily': {
        const rep = await this.reportsService.getDailyRevenueReport(filters);
        reportTitle = rep.title;
        summary = rep.summary;
        records = rep.metrics.map((m) => ({
          Period: m.period,
          'HOC Direct Revenue': m.hocRevenue,
          'HAC Partner Revenue': m.hacRevenue,
          'Company Bulk Revenue': m.companyRevenue,
          'Total Revenue': m.totalRevenue,
          'Transaction Count': m.transactionCount,
        }));
        break;
      }
      case 'revenue_monthly': {
        const rep = await this.reportsService.getMonthlyRevenueReport(filters);
        reportTitle = rep.title;
        summary = rep.summary;
        records = rep.metrics.map((m) => ({
          Month: m.period,
          'HOC Direct Revenue': m.hocRevenue,
          'HAC Partner Revenue': m.hacRevenue,
          'Company Bulk Revenue': m.companyRevenue,
          'Total Revenue': m.totalRevenue,
          'Transaction Count': m.transactionCount,
        }));
        break;
      }
      case 'revenue_annual': {
        const rep = await this.reportsService.getAnnualRevenueReport(filters);
        reportTitle = rep.title;
        summary = rep.summary;
        records = rep.metrics.map((m) => ({
          Year: m.period,
          'Total Revenue': m.totalRevenue,
          Transactions: m.transactionCount,
        }));
        break;
      }
      case 'payments_successful': {
        const rep =
          await this.reportsService.getSuccessfulPaymentsReport(filters);
        reportTitle = rep.title;
        summary = rep.summary;
        records = rep.payments.map((p) => ({
          'Payment Number': p.paymentNumber,
          'Invoice Number': p.invoiceNumber,
          'Customer Name': p.customerName,
          'Amount (₹)': p.amount,
          Method: p.paymentMethod,
          Status: p.status,
          Date: p.paidAt,
        }));
        break;
      }
      case 'commissions_consolidated':
      case 'commissions_pending':
      case 'commissions_paid': {
        const rep =
          await this.reportsService.getConsolidatedCommissionsReport(filters);
        reportTitle = 'Partner Payables Report';
        summary = rep.summary;
        records = rep.payables.map((pp) => ({
          'Partner Name': pp.partnerName,
          'Candidate Name': pp.seafarerName,
          Course: pp.courseName,
          'Approved Hari Om Payable (₹)': pp.approvedPayableAmount,
          'Invoice Number': pp.invoiceNumber,
          Status: pp.status,
          Date: pp.createdAt,
        }));
        break;
      }
      case 'invoices_summary':
      case 'invoices_hoc':
      case 'invoices_hac': {
        const rep =
          await this.reportsService.getConsolidatedInvoicesReport(filters);
        reportTitle = rep.title;
        summary = rep.summary;
        records = rep.invoices.map((inv) => ({
          'Invoice Number': inv.invoiceNumber,
          Type: inv.invoiceType,
          Customer: inv.customerName,
          'Total Amount (₹)': inv.totalAmount,
          'Tax Amount (₹)': inv.taxAmount,
          'Net Payable (₹)': inv.netPayable,
          Status: inv.status,
          Date: inv.createdAt,
        }));
        break;
      }
      case 'settlements_history':
      case 'settlements_pending':
      case 'settlements_paid': {
        const rep =
          await this.reportsService.getSettlementHistoryReport(filters);
        reportTitle = rep.title;
        summary = rep.summary;
        records = rep.settlements.map((s) => ({
          'Settlement Number': s.settlementNumber,
          'Partner Name': s.partnerName,
          'Total Amount (₹)': s.totalAmount,
          'Item Count': s.totalItems,
          Status: s.status,
          'Payment Reference': s.paymentReference || 'N/A',
          Date: s.createdAt,
        }));
        break;
      }
      default: {
        const rep =
          await this.reportsService.getConsolidatedRevenueReport(filters);
        reportTitle = 'Consolidated Financial Report';
        summary = rep.summary;
        records = rep.metrics.map((m) => ({
          Period: m.period,
          'Total Revenue': m.totalRevenue,
          Transactions: m.transactionCount,
        }));
        break;
      }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeTitle = reportTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');

    if (format === 'csv') {
      const csvData = this.generateCsv(records);
      await this.auditService.logFinancialActivity({
        userId: user?.id,
        userName: user?.name,
        action: 'REPORT_EXPORTED_CSV',
        module: 'Finance',
        details: `Exported ${reportTitle} as CSV (${records.length} records)`,
        ipAddress,
      });

      return {
        filename: `${safeTitle}_${timestamp}.csv`,
        contentType: 'text/csv',
        data: csvData,
        rowCount: records.length,
      };
    } else if (format === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(records);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Report Data');
      const excelBuffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
      });

      await this.auditService.logFinancialActivity({
        userId: user?.id,
        userName: user?.name,
        action: 'REPORT_EXPORTED_XLSX',
        module: 'Finance',
        details: `Exported ${reportTitle} as Excel XLSX (${records.length} records)`,
        ipAddress,
      });

      return {
        filename: `${safeTitle}_${timestamp}.xlsx`,
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        data: excelBuffer,
        rowCount: records.length,
      };
    } else {
      return {
        filename: `${safeTitle}_${timestamp}.json`,
        contentType: 'application/json',
        data: { reportTitle, summary, records },
        rowCount: records.length,
      };
    }
  }

  private generateCsv(records: Record<string, any>[]): string {
    if (records.length === 0) return '';
    const headers = Object.keys(records[0]);
    const escapeCsv = (val: any) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const lines = [headers.map(escapeCsv).join(',')];
    for (const row of records) {
      lines.push(headers.map((h) => escapeCsv(row[h])).join(','));
    }
    return lines.join('\r\n');
  }
}
