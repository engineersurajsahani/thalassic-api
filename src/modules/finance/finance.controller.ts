import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Query,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  Ip,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { MasterFinanceGuard } from './guards/master-finance.guard';
import { FinanceService } from './finance.service';
import {
  ReportQueryDto,
  ExportReportDto,
  AuditLogQueryDto,
  CreateFinancialAuditLogDto,
} from './dto/finance.dto';

@Controller('finance')
@UseGuards(AuthGuard, MasterFinanceGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // =========================================================================
  // 1. Overview & Executive Financial Dashboard
  // =========================================================================
  @Get('overview')
  getOverview() {
    return this.financeService.getOverview();
  }

  @Get('dashboard')
  getDashboard() {
    return this.financeService.getOverview();
  }

  @Get('preview')
  async getDashboardHtmlPreview(@Res() res: Response) {
    const escapeHtml = (text: string | undefined | null): string => {
      if (text == null) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const overview = await this.financeService.getOverview();
    const dailyRev = await this.financeService.getDailyRevenue({});
    const invoices = await this.financeService.getInvoiceSummary({});
    const auditLogs = await this.financeService.getAuditLogs({ limit: 10 });
    const settlements = await this.financeService.getSettlementHistory({});
    const payments = await this.financeService.getConsolidatedPayments({});
    const payables = await this.financeService.getConsolidatedCommissions({});

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hari Om Thalassic - Financial Control Center</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-base: #070c18;
      --bg-surface: #0f172a;
      --bg-card: rgba(15, 23, 42, 0.75);
      --border-color: rgba(255, 255, 255, 0.08);
      --text-primary: #f8fafc;
      --text-secondary: #94a3b8;
      --accent-emerald: #10b981;
      --accent-cyan: #06b6d4;
      --accent-amber: #f59e0b;
      --gradient-brand: linear-gradient(135deg, #2563eb, #06b6d4);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Plus Jakarta Sans', sans-serif; }
    body { background: var(--bg-base); color: var(--text-primary); padding: 2rem; }
    .container { max-width: 1400px; margin: 0 auto; }
    .grid-kpi { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
    .kpi-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 14px; padding: 1.25rem; }
    .kpi-label { font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 0.35rem; }
    .kpi-value { font-size: 1.5rem; font-weight: 800; color: #fff; }
    .table-container { overflow-x: auto; background: var(--bg-card); border-radius: 14px; border: 1px solid var(--border-color); padding: 1rem; margin-top: 1rem; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { padding: 0.75rem 1rem; color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; border-bottom: 1px solid var(--border-color); }
    td { padding: 0.75rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="container">
    <header style="margin-bottom:2rem;">
      <h1>⚓ Hari Om Thalassic - Financial Control Center</h1>
      <p style="color:var(--text-secondary);">Accredited MTI-10294 | Rebuild 2.0 Unified Relational Ledger</p>
    </header>

    <div class="grid-kpi">
      <div class="kpi-card">
        <div class="kpi-label">Total Platform Revenue</div>
        <div class="kpi-value">₹${escapeHtml(overview.totalRevenue.toLocaleString('en-IN'))}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">HOC Direct Revenue</div>
        <div class="kpi-value">₹${escapeHtml(overview.hocRevenue.toLocaleString('en-IN'))}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">HAC Partner Revenue</div>
        <div class="kpi-value">₹${escapeHtml(overview.hacRevenue.toLocaleString('en-IN'))}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Company Bulk Revenue</div>
        <div class="kpi-value">₹${escapeHtml(overview.companyRevenue.toLocaleString('en-IN'))}</div>
      </div>
    </div>

    <div class="table-container">
      <h3>Recent Verified Invoices (${invoices.invoices.length})</h3>
      <table>
        <thead>
          <tr>
            <th>Invoice Number</th>
            <th>Type</th>
            <th>Customer</th>
            <th>Total Amount</th>
            <th>Net Payable</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${invoices.invoices
            .slice(0, 10)
            .map(
              (inv) => `
            <tr>
              <td><strong>${escapeHtml(inv.invoiceNumber)}</strong></td>
              <td>${escapeHtml(inv.invoiceType)}</td>
              <td>${escapeHtml(inv.customerName)}</td>
              <td>₹${escapeHtml(inv.totalAmount.toLocaleString('en-IN'))}</td>
              <td><strong style="color:var(--accent-emerald)">₹${escapeHtml(inv.netPayable.toLocaleString('en-IN'))}</strong></td>
              <td>${escapeHtml(inv.status)}</td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  // =========================================================================
  // 2. Revenue Reports
  // =========================================================================
  @Get('reports/revenue')
  getConsolidatedRevenue(@Query() query: ReportQueryDto) {
    return this.financeService.getConsolidatedRevenue(query);
  }

  @Get('reports/revenue/daily')
  getDailyRevenue(@Query() query: ReportQueryDto) {
    return this.financeService.getDailyRevenue(query);
  }

  @Get('reports/revenue/monthly')
  getMonthlyRevenue(@Query() query: ReportQueryDto) {
    return this.financeService.getMonthlyRevenue(query);
  }

  @Get('reports/revenue/annual')
  getAnnualRevenue(@Query() query: ReportQueryDto) {
    return this.financeService.getAnnualRevenue(query);
  }

  // =========================================================================
  // 3. Payment Reports
  // =========================================================================
  @Get('reports/payments')
  getConsolidatedPayments(@Query() query: ReportQueryDto) {
    return this.financeService.getConsolidatedPayments(query);
  }

  @Get('reports/payments/successful')
  getSuccessfulPayments(@Query() query: ReportQueryDto) {
    return this.financeService.getSuccessfulPayments(query);
  }

  @Get('reports/payments/failed')
  getFailedPayments(@Query() query: ReportQueryDto) {
    return this.financeService.getFailedPayments(query);
  }

  @Get('reports/payments/pending')
  getPendingPayments(@Query() query: ReportQueryDto) {
    return this.financeService.getPendingPayments(query);
  }

  // =========================================================================
  // 4. Partner Payables Reports (Replaces Commissions)
  // =========================================================================
  @Get('reports/commissions')
  getConsolidatedCommissions(@Query() query: ReportQueryDto) {
    return this.financeService.getConsolidatedCommissions(query);
  }

  @Get('reports/commissions/pending')
  getPendingCommissions(@Query() query: ReportQueryDto) {
    return this.financeService.getPendingCommissions(query);
  }

  @Get('reports/commissions/paid')
  getPaidCommissions(@Query() query: ReportQueryDto) {
    return this.financeService.getPaidCommissions(query);
  }

  @Get('reports/commissions/outstanding')
  getOutstandingCommissions(@Query() query: ReportQueryDto) {
    return this.financeService.getOutstandingCommissions(query);
  }

  // =========================================================================
  // 5. Invoice Reports
  // =========================================================================
  @Get('reports/invoices')
  getConsolidatedInvoices(@Query() query: ReportQueryDto) {
    return this.financeService.getConsolidatedInvoices(query);
  }

  @Get('reports/invoices/hoc')
  getHocInvoices(@Query() query: ReportQueryDto) {
    return this.financeService.getHocInvoices(query);
  }

  @Get('reports/invoices/hac')
  getHacInvoices(@Query() query: ReportQueryDto) {
    return this.financeService.getHacInvoices(query);
  }

  @Get('reports/invoices/summary')
  getInvoiceSummary(@Query() query: ReportQueryDto) {
    return this.financeService.getInvoiceSummary(query);
  }

  // =========================================================================
  // 6. Settlement Reports
  // =========================================================================
  @Get('reports/settlements')
  getConsolidatedSettlements(@Query() query: ReportQueryDto) {
    return this.financeService.getConsolidatedSettlements(query);
  }

  @Get('reports/settlements/pending')
  getPendingSettlements(@Query() query: ReportQueryDto) {
    return this.financeService.getPendingSettlements(query);
  }

  @Get('reports/settlements/paid')
  getPaidSettlements(@Query() query: ReportQueryDto) {
    return this.financeService.getPaidSettlements(query);
  }

  @Get('reports/settlements/history')
  getSettlementHistory(@Query() query: ReportQueryDto) {
    return this.financeService.getSettlementHistory(query);
  }

  // =========================================================================
  // 7. Multi-Format Report Export (PDF, Excel XLSX, CSV)
  // =========================================================================
  @Get('reports/export')
  async exportReportGet(
    @Query() dto: ExportReportDto,
    @Req() req: Request,
    @Res() res: Response,
    @Ip() ipAddress: string,
  ) {
    return this.handleExport(dto, req, res, ipAddress);
  }

  @Post('reports/export')
  async exportReportPost(
    @Body() dto: ExportReportDto,
    @Req() req: Request,
    @Res() res: Response,
    @Ip() ipAddress: string,
  ) {
    return this.handleExport(dto, req, res, ipAddress);
  }

  private async handleExport(
    dto: ExportReportDto,
    req: Request,
    res: Response,
    ipAddress: string,
  ) {
    const user = (req as any).user || { name: 'Master Admin' };
    const result = await this.financeService.exportReport(dto, user, ipAddress);

    if (dto.format === 'csv') {
      res.setHeader('Content-Type', result.contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${result.filename}"`,
      );
      return res.send(result.data);
    } else if (dto.format === 'xlsx') {
      res.setHeader('Content-Type', result.contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${result.filename}"`,
      );
      return res.send(result.data);
    } else {
      return res.json(result);
    }
  }

  // =========================================================================
  // 8. Financial Audit Logs
  // =========================================================================
  @Get('audit-logs')
  getAuditLogs(@Query() query: AuditLogQueryDto) {
    return this.financeService.getAuditLogs(query);
  }

  @Get('audit-logs/:id')
  getAuditLogById(@Param('id') id: string) {
    return this.financeService.getAuditLogById(id);
  }

  @Post('audit-logs')
  logFinancialActivity(
    @Body() dto: CreateFinancialAuditLogDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.financeService.logFinancialActivity(dto, user);
  }

  @Patch('audit-logs/:id')
  updateAuditLogPatch() {
    return this.financeService.updateAuditLog();
  }

  @Put('audit-logs/:id')
  updateAuditLogPut() {
    return this.financeService.updateAuditLog();
  }

  @Delete('audit-logs/:id')
  deleteAuditLog() {
    return this.financeService.deleteAuditLog();
  }
}
