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

    // 1. Fetch the corresponding dataset based on reportType
    let reportTitle = 'Financial Report';
    let records: Record<string, any>[] = [];
    let summary: Record<string, any> = {};

    switch (reportType) {
      case 'revenue_daily': {
        const rep = await this.reportsService.getDailyRevenueReport(filters);
        reportTitle = rep.reportTitle;
        summary = rep.summary;
        records = rep.breakdown.map((item) => ({
          'Date Period': item.period,
          'Gross Revenue (₹)': item.grossRevenue,
          'Discount (₹)': item.discountAmount,
          'Net Revenue (₹)': item.netRevenue,
          'Transaction Count': item.transactionCount,
          'Average Order Value (₹)': item.averageTicketSize,
          'Growth Rate (%)': item.growthRatePercent ?? 'N/A',
        }));
        break;
      }
      case 'revenue_monthly': {
        const rep = await this.reportsService.getMonthlyRevenueReport(filters);
        reportTitle = rep.reportTitle;
        summary = rep.summary;
        records = rep.breakdown.map((item) => ({
          'Month Period': item.period,
          'Gross Revenue (₹)': item.grossRevenue,
          'Discount (₹)': item.discountAmount,
          'Net Revenue (₹)': item.netRevenue,
          'Transaction Count': item.transactionCount,
          'Average Order Value (₹)': item.averageTicketSize,
          'Growth Rate (%)': item.growthRatePercent ?? 'N/A',
        }));
        break;
      }
      case 'revenue_annual': {
        const rep = await this.reportsService.getAnnualRevenueReport(filters);
        reportTitle = rep.reportTitle;
        summary = rep.summary;
        records = rep.breakdown.map((item) => ({
          'Year Period': item.period,
          'Gross Revenue (₹)': item.grossRevenue,
          'Discount (₹)': item.discountAmount,
          'Net Revenue (₹)': item.netRevenue,
          'Transaction Count': item.transactionCount,
          'Average Order Value (₹)': item.averageTicketSize,
        }));
        break;
      }
      case 'revenue_consolidated': {
        const rep = await this.reportsService.getConsolidatedRevenueReport(filters);
        reportTitle = rep.reportTitle;
        summary = rep.summary;
        records = rep.breakdown.map((item) => ({
          'Date': item.period,
          'Gross Revenue (₹)': item.grossRevenue,
          'Net Revenue (₹)': item.netRevenue,
          'Transactions': item.transactionCount,
        }));
        break;
      }
      case 'payments_successful': {
        const rep = await this.reportsService.getSuccessfulPaymentsReport(filters);
        reportTitle = rep.reportTitle;
        summary = rep.summary;
        records = rep.payments.map((p) => ({
          'Transaction ID': p.transactionId,
          'Invoice Number': p.invoiceNumber || 'N/A',
          'Customer Name': p.customerName,
          'Customer Email': p.customerEmail,
          'Course Name': p.courseName,
          'Amount (₹)': p.amount,
          'Payment Gateway': p.paymentGateway,
          'Payment Method': p.paymentMethod,
          'Status': p.status,
          'Payment Date': new Date(p.completedAt || p.createdAt).toLocaleString('en-IN'),
        }));
        break;
      }
      case 'payments_failed': {
        const rep = await this.reportsService.getFailedPaymentsReport(filters);
        reportTitle = rep.reportTitle;
        summary = rep.summary;
        records = rep.payments.map((p) => ({
          'Transaction ID': p.transactionId,
          'Customer Name': p.customerName,
          'Customer Email': p.customerEmail,
          'Course Name': p.courseName,
          'Attempted Amount (₹)': p.amount,
          'Payment Gateway': p.paymentGateway,
          'Status': p.status,
          'Failure Reason': p.failureReason || 'Declined by Gateway',
          'Attempt Date': new Date(p.createdAt).toLocaleString('en-IN'),
        }));
        break;
      }
      case 'payments_pending': {
        const rep = await this.reportsService.getPendingPaymentsReport(filters);
        reportTitle = rep.reportTitle;
        summary = rep.summary;
        records = rep.payments.map((p) => ({
          'Transaction ID': p.transactionId,
          'Customer Name': p.customerName,
          'Customer Email': p.customerEmail,
          'Course Name': p.courseName,
          'Pending Amount (₹)': p.amount,
          'Payment Gateway': p.paymentGateway,
          'Status': p.status,
          'Created Date': new Date(p.createdAt).toLocaleString('en-IN'),
        }));
        break;
      }
      case 'payments_consolidated': {
        const rep = await this.reportsService.getConsolidatedPaymentsReport(filters);
        reportTitle = rep.reportTitle;
        summary = rep.summary;
        records = rep.payments.map((p) => ({
          'Transaction ID': p.transactionId,
          'Customer Name': p.customerName,
          'Course Name': p.courseName,
          'Amount (₹)': p.amount,
          'Status': p.status,
          'Date': new Date(p.createdAt).toLocaleDateString('en-IN'),
        }));
        break;
      }
      case 'commissions_pending': {
        const rep = await this.reportsService.getPendingCommissionsReport(filters);
        reportTitle = rep.reportTitle;
        summary = rep.summary;
        records = rep.commissions.map((c) => ({
          'Commission ID': c.id,
          'Agent Name': c.agentName,
          'Referral Code': c.referralCode || 'N/A',
          'Candidate Name': c.seafarerName,
          'Course Name': c.courseName,
          'Course Fee (₹)': c.courseFee,
          'Commission Rate (%)': c.commissionRate,
          'Commission Amount (₹)': c.commissionAmount,
          'Commission Source': c.commissionSource,
          'Status': c.status,
          'Created Date': new Date(c.createdAt).toLocaleDateString('en-IN'),
        }));
        break;
      }
      case 'commissions_paid': {
        const rep = await this.reportsService.getPaidCommissionsReport(filters);
        reportTitle = rep.reportTitle;
        summary = rep.summary;
        records = rep.commissions.map((c) => ({
          'Commission ID': c.id,
          'Agent Name': c.agentName,
          'Candidate Name': c.seafarerName,
          'Course Name': c.courseName,
          'Course Fee (₹)': c.courseFee,
          'Commission Amount (₹)': c.commissionAmount,
          'Settlement ID': c.settlementId || 'N/A',
          'Status': c.status,
          'Disbursed Date': c.settledAt ? new Date(c.settledAt).toLocaleDateString('en-IN') : 'N/A',
        }));
        break;
      }
      case 'commissions_outstanding': {
        const rep = await this.reportsService.getOutstandingCommissionsReport(filters);
        reportTitle = rep.reportTitle;
        summary = rep.summary;
        records = rep.commissions.map((c) => ({
          'Commission ID': c.id,
          'Agent Name': c.agentName,
          'Candidate Name': c.seafarerName,
          'Course Name': c.courseName,
          'Course Fee (₹)': c.courseFee,
          'Approved Commission (₹)': c.commissionAmount,
          'Status': c.status,
          'Approved Date': new Date(c.createdAt).toLocaleDateString('en-IN'),
        }));
        break;
      }
      case 'commissions_consolidated': {
        const rep = await this.reportsService.getConsolidatedCommissionsReport(filters);
        reportTitle = rep.reportTitle;
        summary = rep.summary;
        records = rep.commissions.map((c) => ({
          'Agent': c.agentName,
          'Candidate': c.seafarerName,
          'Course': c.courseName,
          'Amount (₹)': c.commissionAmount,
          'Status': c.status,
          'Date': new Date(c.createdAt).toLocaleDateString('en-IN'),
        }));
        break;
      }
      case 'invoices_hoc': {
        const rep = await this.reportsService.getHocInvoicesReport(filters);
        reportTitle = rep.reportTitle;
        summary = rep.summary;
        records = rep.invoices.map((inv) => ({
          'Invoice Number': inv.invoiceNumber,
          'Invoice Type': inv.invoiceType,
          'Candidate Name': inv.customerName,
          'Candidate Email': inv.customerEmail,
          'Candidate Phone': inv.customerPhone,
          'Course Name': inv.courseName,
          'Course Fee (₹)': inv.courseFee,
          'Discount (₹)': inv.discount,
          'Final Paid (₹)': inv.finalAmount,
          'Estimated GST (₹)': inv.taxAmount,
          'Payment Mode': inv.paymentMethod,
          'Transaction ID': inv.transactionId,
          'Invoice Date': new Date(inv.createdAt).toLocaleDateString('en-IN'),
        }));
        break;
      }
      case 'invoices_hac': {
        const rep = await this.reportsService.getHacInvoicesReport(filters);
        reportTitle = rep.reportTitle;
        summary = rep.summary;
        records = rep.invoices.map((inv) => ({
          'Invoice Number': inv.invoiceNumber,
          'Invoice Type': inv.invoiceType,
          'Candidate Name': inv.customerName,
          'Referring Agent': inv.agentName || 'N/A',
          'Referral Code': inv.agentReferralCode || 'N/A',
          'Course Name': inv.courseName,
          'Course Fee (₹)': inv.courseFee,
          'Final Paid (₹)': inv.finalAmount,
          'Estimated GST (₹)': inv.taxAmount,
          'Transaction ID': inv.transactionId,
          'Invoice Date': new Date(inv.createdAt).toLocaleDateString('en-IN'),
        }));
        break;
      }
      case 'invoices_summary':
      case 'invoices_consolidated': {
        const rep = await this.reportsService.getInvoiceSummaryReport(filters);
        reportTitle = rep.reportTitle;
        summary = rep.summary;
        records = rep.invoices.map((inv) => ({
          'Invoice Number': inv.invoiceNumber,
          'Type': inv.invoiceType,
          'Candidate': inv.customerName,
          'Course': inv.courseName,
          'Amount (₹)': inv.finalAmount,
          'GST (₹)': inv.taxAmount,
          'Status': inv.status,
          'Date': new Date(inv.createdAt).toLocaleDateString('en-IN'),
        }));
        break;
      }
      case 'settlements_pending': {
        const rep = await this.reportsService.getPendingSettlementsReport(filters);
        reportTitle = rep.reportTitle;
        summary = rep.summary;
        records = rep.settlements.map((s) => ({
          'Settlement Batch #': s.settlementNumber,
          'Agent Name': s.agentName,
          'Linked HAC Invoice': s.hacInvoiceNumber || 'N/A',
          'Batch Total (₹)': s.totalAmount,
          'Status': s.status,
          'Batch Created Date': new Date(s.createdAt).toLocaleDateString('en-IN'),
        }));
        break;
      }
      case 'settlements_paid': {
        const rep = await this.reportsService.getPaidSettlementsReport(filters);
        reportTitle = rep.reportTitle;
        summary = rep.summary;
        records = rep.settlements.map((s) => ({
          'Settlement Batch #': s.settlementNumber,
          'Agent Name': s.agentName,
          'Linked HAC Invoice': s.hacInvoiceNumber || 'N/A',
          'Disbursed Amount (₹)': s.totalAmount,
          'Status': s.status,
          'Created Date': new Date(s.createdAt).toLocaleDateString('en-IN'),
          'Paid Date': s.paidAt ? new Date(s.paidAt).toLocaleDateString('en-IN') : 'N/A',
        }));
        break;
      }
      case 'settlements_history':
      case 'settlements_consolidated': {
        const rep = await this.reportsService.getSettlementHistoryReport(filters);
        reportTitle = rep.reportTitle;
        summary = rep.summary;
        records = rep.settlements.map((s) => ({
          'Settlement Batch #': s.settlementNumber,
          'Agent Name': s.agentName,
          'HAC Invoice #': s.hacInvoiceNumber || 'N/A',
          'Total Amount (₹)': s.totalAmount,
          'Status': s.status,
          'Created Date': new Date(s.createdAt).toLocaleDateString('en-IN'),
          'Disbursed Date': s.paidAt ? new Date(s.paidAt).toLocaleDateString('en-IN') : 'Pending',
        }));
        break;
      }
      default:
        throw new BadRequestException(`Unsupported report type: ${reportType}`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const cleanName = reportType.replace(/_/g, '-');

    // 2. Format Generator (CSV, XLSX, PDF)
    let exportData: Buffer | string | object = '';
    let contentType = '';
    let filename = '';

    if (format === 'csv') {
      filename = `${cleanName}-${timestamp}.csv`;
      contentType = 'text/csv; charset=utf-8';
      exportData = this.generateCsv(records);
    } else if (format === 'xlsx') {
      filename = `${cleanName}-${timestamp}.xlsx`;
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      exportData = this.generateXlsx(reportTitle, records, summary);
    } else if (format === 'pdf') {
      filename = `${cleanName}-${timestamp}.pdf`;
      contentType = 'application/json'; // Structured printable PDF document response
      exportData = this.generatePdfDocumentModel(reportTitle, records, summary);
    }

    // 3. Section 7.8 Business Rule: "Report generation and export shall be logged."
    await this.auditService.logFinancialActivity({
      userId: user?.id,
      userName: user?.name || 'Master Admin',
      action: 'REPORT_EXPORTED',
      module: 'Reports',
      entityId: reportType,
      details: `Exported ${reportTitle} in ${format.toUpperCase()} format (${records.length} records)`,
      previousValue: null,
      updatedValue: { reportType, format, recordCount: records.length },
      ipAddress,
    });

    return {
      filename,
      contentType,
      data: exportData,
      rowCount: records.length,
    };
  }

  // --- RFC 4180 Compliant CSV Generator ---
  private generateCsv(records: Record<string, any>[]): string {
    if (records.length === 0) return 'No records found\n';

    const headers = Object.keys(records[0]);
    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerLine = headers.map(escapeCsv).join(',');
    const rows = records.map((rec) => headers.map((h) => escapeCsv(rec[h])).join(','));

    return [headerLine, ...rows].join('\r\n');
  }

  // --- Native Excel XLSX Generator ---
  private generateXlsx(
    reportTitle: string,
    records: Record<string, any>[],
    summary: Record<string, any>,
  ): Buffer {
    const workbook = XLSX.utils.book_new();

    // Prepare data sheet
    const ws = XLSX.utils.json_to_sheet(records);

    // Append sheet to workbook
    XLSX.utils.book_append_sheet(workbook, ws, 'Report Data');

    // If summary exists, append summary sheet
    if (Object.keys(summary).length > 0) {
      const summaryRows = Object.entries(summary).map(([key, val]) => ({
        'Metric / KPI': key.replace(/([A-Z])/g, ' $1').toUpperCase(),
        'Value': typeof val === 'number' ? val : String(val),
      }));
      const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(workbook, summaryWs, 'Summary KPIs');
    }

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  // --- PDF Formatted Document Structure Model ---
  private generatePdfDocumentModel(
    reportTitle: string,
    records: Record<string, any>[],
    summary: Record<string, any>,
  ): object {
    return {
      documentType: 'FINANCIAL_REPORT_PDF',
      institute: {
        name: 'Hari Om Thalassic Maritime Training Institute',
        address: 'Suite 404, Marine Trade Tower, Ballard Estate, Mumbai, Maharashtra 400001',
        email: 'support@hariomthalassic.com',
        phone: '+91 22 12345678',
        dgsAccreditationId: 'DGS-MTI-10294',
        gstin: '27AABCH1234F1Z5',
      },
      metadata: {
        reportTitle,
        generatedAt: new Date().toISOString(),
        formattedDate: new Date().toLocaleString('en-IN'),
        totalRecords: records.length,
        currency: 'INR (₹)',
        confidentialityNotice: 'Confidential & Proprietary - Authorized Master/Finance Access Only',
      },
      summary,
      headers: records.length > 0 ? Object.keys(records[0]) : [],
      rows: records,
    };
  }
}
