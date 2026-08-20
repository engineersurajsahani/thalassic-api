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
    const overview = await this.financeService.getOverview();
    const dailyRev = await this.financeService.getDailyRevenue({});
    const invoices = await this.financeService.getInvoiceSummary({});
    const auditLogs = await this.financeService.getAuditLogs({ limit: 10 });
    const settlements = await this.financeService.getSettlementHistory({});

    const monthlyRev = await this.financeService.getMonthlyRevenue({});
    const payments = await this.financeService.getConsolidatedPayments({});
    const commissions = await this.financeService.getConsolidatedCommissions({});

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
      --bg-card-hover: rgba(30, 41, 59, 0.85);
      --border-color: rgba(255, 255, 255, 0.08);
      --border-glow: rgba(59, 130, 246, 0.35);
      --text-primary: #f8fafc;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --accent-blue: #3b82f6;
      --accent-cyan: #06b6d4;
      --accent-emerald: #10b981;
      --accent-amber: #f59e0b;
      --accent-rose: #f43f5e;
      --accent-purple: #a855f7;
      --gradient-brand: linear-gradient(135deg, #2563eb, #06b6d4);
      --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
      --shadow-lg: 0 12px 32px -4px rgba(0, 0, 0, 0.6);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; }
    body { background-color: var(--bg-base); color: var(--text-primary); min-height: 100vh; padding: 2rem; background-image: radial-gradient(circle at 10% 10%, rgba(37, 99, 235, 0.12) 0%, transparent 40%), radial-gradient(circle at 90% 90%, rgba(6, 182, 212, 0.1) 0%, transparent 40%); }
    .container { max-width: 1520px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 1.75rem; border-bottom: 1px solid var(--border-color); margin-bottom: 2rem; }
    .brand { display: flex; align-items: center; gap: 1rem; }
    .brand-icon { width: 50px; height: 50px; border-radius: 14px; background: var(--gradient-brand); display: flex; align-items: center; justify-content: center; font-size: 1.6rem; box-shadow: 0 0 24px rgba(6, 182, 212, 0.45); }
    .brand-text h1 { font-size: 1.55rem; font-weight: 800; letter-spacing: -0.02em; background: linear-gradient(to right, #ffffff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .brand-text p { font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem; }
    .badge-master { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.45rem 1rem; border-radius: 9999px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); color: var(--accent-emerald); font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
    .badge-dot { width: 7px; height: 7px; border-radius: 50%; background-color: var(--accent-emerald); box-shadow: 0 0 10px var(--accent-emerald); }
    
    /* 6 KPI Cards Grid */
    .grid-kpi { display: grid; grid-template-columns: repeat(6, 1fr); gap: 1.1rem; margin-bottom: 2.25rem; }
    @media (max-width: 1280px) { .grid-kpi { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 768px) { .grid-kpi { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 480px) { .grid-kpi { grid-template-columns: 1fr; } }

    .kpi-card { background: var(--bg-card); backdrop-filter: blur(20px); border: 1px solid var(--border-color); border-radius: 16px; padding: 1.35rem 1.25rem; transition: all 0.25s ease; position: relative; overflow: hidden; }
    .kpi-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--gradient-brand); opacity: 0; transition: opacity 0.3s; }
    .kpi-card:hover { transform: translateY(-4px); border-color: rgba(255, 255, 255, 0.18); box-shadow: var(--shadow-lg); }
    .kpi-card:hover::before { opacity: 1; }
    .kpi-label { font-size: 0.72rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.06em; color: var(--text-secondary); margin-bottom: 0.4rem; }
    .kpi-value { font-size: 1.65rem; font-weight: 800; color: #fff; letter-spacing: -0.02em; line-height: 1.2; }
    .kpi-sub { font-size: 0.75rem; color: var(--accent-emerald); margin-top: 0.35rem; display: flex; align-items: center; gap: 0.3rem; font-weight: 500; }
    .kpi-sub.amber { color: var(--accent-amber); }
    .kpi-sub.blue { color: var(--accent-cyan); }
    
    /* Navigation Tabs */
    .tabs-nav { display: flex; gap: 0.6rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.6rem; overflow-x: auto; }
    .tab-btn { background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color); color: var(--text-secondary); padding: 0.75rem 1.25rem; font-size: 0.88rem; font-weight: 600; border-radius: 12px; cursor: pointer; transition: all 0.2s; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; }
    .tab-btn:hover { color: #fff; background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.2); }
    .tab-btn.active { color: #fff; background: var(--gradient-brand); border-color: transparent; box-shadow: 0 4px 18px rgba(37, 99, 235, 0.35); }
    
    .tab-pane { display: none; }
    .tab-pane.active { display: block; animation: fadeIn 0.25s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
    
    .card-section { background: var(--bg-card); backdrop-filter: blur(20px); border: 1px solid var(--border-color); border-radius: 20px; padding: 1.75rem; margin-bottom: 2rem; box-shadow: var(--shadow-sm); }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }
    .section-title { font-size: 1.2rem; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 0.5rem; }
    .export-btns { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .btn-export { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 0.95rem; border-radius: 9px; font-size: 0.8rem; font-weight: 700; text-decoration: none; transition: all 0.2s; border: 1px solid var(--border-color); cursor: pointer; }
    .btn-csv { background: rgba(16, 185, 129, 0.12); color: var(--accent-emerald); border-color: rgba(16, 185, 129, 0.3); }
    .btn-csv:hover { background: var(--accent-emerald); color: #000; box-shadow: 0 0 15px rgba(16, 185, 129, 0.4); }
    .btn-xlsx { background: rgba(59, 130, 246, 0.12); color: var(--accent-blue); border-color: rgba(59, 130, 246, 0.3); }
    .btn-xlsx:hover { background: var(--accent-blue); color: #fff; box-shadow: 0 0 15px rgba(59, 130, 246, 0.4); }
    .btn-pdf { background: rgba(244, 63, 94, 0.12); color: var(--accent-rose); border-color: rgba(244, 63, 94, 0.3); }
    .btn-pdf:hover { background: var(--accent-rose); color: #fff; box-shadow: 0 0 15px rgba(244, 63, 94, 0.4); }
    
    .table-container { overflow-x: auto; border-radius: 12px; border: 1px solid var(--border-color); }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { padding: 0.95rem 1.1rem; font-size: 0.74rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); border-bottom: 1px solid var(--border-color); background: rgba(255, 255, 255, 0.02); }
    td { padding: 1.05rem 1.1rem; font-size: 0.88rem; color: var(--text-primary); border-bottom: 1px solid rgba(255, 255, 255, 0.04); }
    tr:hover td { background: rgba(255, 255, 255, 0.03); }
    tr:last-child td { border-bottom: none; }
    .code-tag { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; padding: 0.25rem 0.55rem; border-radius: 6px; background: rgba(255, 255, 255, 0.06); color: var(--accent-cyan); }
    .status-badge { display: inline-block; padding: 0.28rem 0.7rem; border-radius: 6px; font-size: 0.74rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
    .status-paid, .status-successful { background: rgba(16, 185, 129, 0.15); color: var(--accent-emerald); }
    .status-pending { background: rgba(245, 158, 11, 0.15); color: var(--accent-amber); }
    .status-failed { background: rgba(244, 63, 94, 0.15); color: var(--accent-rose); }
    .status-hoc { background: rgba(168, 85, 247, 0.15); color: var(--accent-purple); }
    .status-hac { background: rgba(6, 182, 212, 0.15); color: var(--accent-cyan); }
    
    .search-bar { display: flex; align-items: center; gap: 0.5rem; background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border-color); border-radius: 10px; padding: 0.5rem 0.9rem; max-width: 320px; }
    .search-bar input { background: transparent; border: none; outline: none; color: #fff; font-size: 0.85rem; width: 100%; }
    .search-bar input::placeholder { color: var(--text-muted); }
    footer { text-align: center; margin-top: 3rem; font-size: 0.85rem; color: var(--text-muted); padding-top: 1.5rem; border-top: 1px solid var(--border-color); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <div class="brand-icon">⚓</div>
        <div class="brand-text">
          <h1>Hari Om Thalassic - Financial Control Center</h1>
          <p>DGS Accredited (MTI-10294) | Chapter 7 Unified Finance & Permanent Audit Ledger</p>
        </div>
      </div>
      <div>
        <span class="badge-master"><span class="badge-dot"></span> Master Authenticated</span>
      </div>
    </header>

    <!-- 6 KPI Cards in Balanced 6-Column Grid -->
    <div class="grid-kpi">
      <div class="kpi-card">
        <div class="kpi-label">Gross Platform Revenue</div>
        <div class="kpi-value">${overview.kpis.formattedGrossPlatformRevenue}</div>
        <div class="kpi-sub">Verified Invoices</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Net Collections</div>
        <div class="kpi-value">${overview.kpis.formattedNetPlatformRevenue}</div>
        <div class="kpi-sub blue">100% Reconciled</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Commissions Paid</div>
        <div class="kpi-value">${overview.kpis.formattedTotalCommissionsPaid}</div>
        <div class="kpi-sub">Settled Partners</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Outstanding Payables</div>
        <div class="kpi-value">${overview.kpis.formattedOutstandingCommissionPayables}</div>
        <div class="kpi-sub amber">Approved & Queued</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Invoices Generated</div>
        <div class="kpi-value">${overview.kpis.totalInvoicesGenerated}</div>
        <div class="kpi-sub blue">${invoices.summary.hocCount} HOC / ${invoices.summary.hacCount} HAC</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Payment Success Rate</div>
        <div class="kpi-value">${overview.kpis.paymentSuccessRate}</div>
        <div class="kpi-sub">Razorpay Verified</div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="tabs-nav">
      <button class="tab-btn active" onclick="switchTab(this, 'tab-revenue')">📊 Revenue Reports</button>
      <button class="tab-btn" onclick="switchTab(this, 'tab-payments')">💳 Payment Reports</button>
      <button class="tab-btn" onclick="switchTab(this, 'tab-commissions')">🤝 Commission Reports</button>
      <button class="tab-btn" onclick="switchTab(this, 'tab-invoices')">📑 Invoice Reports (HOC & HAC)</button>
      <button class="tab-btn" onclick="switchTab(this, 'tab-settlements')">💰 Settlements & History</button>
      <button class="tab-btn" onclick="switchTab(this, 'tab-audit')">🛡️ Permanent Audit Logs (7.8)</button>
    </div>

    <!-- TAB 1: REVENUE -->
    <div id="tab-revenue" class="tab-pane active">
      <div class="card-section">
        <div class="section-header">
          <div class="section-title">📊 Daily & Monthly Revenue Insights</div>
          <div class="export-btns">
            <a href="/api/finance/reports/export?reportType=revenue_daily&format=csv&token=mock-master-token" class="btn-export btn-csv">📥 Export CSV</a>
            <a href="/api/finance/reports/export?reportType=revenue_daily&format=xlsx&token=mock-master-token" class="btn-export btn-xlsx">📊 Excel (XLSX)</a>
            <a href="/api/finance/reports/export?reportType=revenue_daily&format=pdf&token=mock-master-token" target="_blank" class="btn-export btn-pdf">📄 PDF Data</a>
          </div>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Transactions</th>
                <th>Gross Revenue</th>
                <th>Discount</th>
                <th>Net Revenue</th>
                <th>Avg Ticket Size</th>
                <th>Growth Rate</th>
              </tr>
            </thead>
            <tbody>
              ${dailyRev.breakdown.map((item: any) => `
                <tr>
                  <td><strong>${item.period}</strong></td>
                  <td><span class="code-tag">${item.transactionCount} bookings</span></td>
                  <td>₹${item.grossRevenue.toLocaleString('en-IN')}</td>
                  <td>₹${item.discountAmount.toLocaleString('en-IN')}</td>
                  <td><strong style="color:var(--accent-emerald)">₹${item.netRevenue.toLocaleString('en-IN')}</strong></td>
                  <td>₹${item.averageTicketSize.toLocaleString('en-IN')}</td>
                  <td>${item.growthRatePercent ? `<span style="color:var(--accent-emerald);font-weight:700">+${item.growthRatePercent}%</span>` : '<span style="color:var(--text-muted)">Baseline</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 2: PAYMENTS -->
    <div id="tab-payments" class="tab-pane">
      <div class="card-section">
        <div class="section-header">
          <div class="section-title">💳 Platform Payment Transactions (${payments.payments.length} records)</div>
          <div class="export-btns">
            <a href="/api/finance/reports/export?reportType=payments_successful&format=csv&token=mock-master-token" class="btn-export btn-csv">📥 Export CSV</a>
            <a href="/api/finance/reports/export?reportType=payments_successful&format=xlsx&token=mock-master-token" class="btn-export btn-xlsx">📊 Excel (XLSX)</a>
            <a href="/api/finance/reports/export?reportType=payments_successful&format=pdf&token=mock-master-token" target="_blank" class="btn-export btn-pdf">📄 PDF Data</a>
          </div>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Customer</th>
                <th>Course</th>
                <th>Amount</th>
                <th>Gateway & Method</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${payments.payments.map((p: any) => `
                <tr>
                  <td><span class="code-tag">${p.transactionId}</span></td>
                  <td><strong>${p.customerName}</strong><br><small style="color:var(--text-muted)">${p.customerEmail}</small></td>
                  <td>${p.courseName}</td>
                  <td><strong>₹${p.amount.toLocaleString('en-IN')}</strong></td>
                  <td>${p.paymentGateway}<br><small style="color:var(--text-muted)">${p.paymentMethod}</small></td>
                  <td><span class="status-badge ${p.status === 'Successful' ? 'status-successful' : p.status === 'Failed' ? 'status-failed' : 'status-pending'}">${p.status}</span></td>
                  <td><small style="color:var(--text-muted)">${new Date(p.createdAt).toLocaleString('en-IN')}</small></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 3: COMMISSIONS -->
    <div id="tab-commissions" class="tab-pane">
      <div class="card-section">
        <div class="section-header">
          <div class="section-title">🤝 Partner Commission Ledger (${commissions.commissions.length} records)</div>
          <div class="export-btns">
            <a href="/api/finance/reports/export?reportType=commissions_consolidated&format=csv&token=mock-master-token" class="btn-export btn-csv">📥 Export CSV</a>
            <a href="/api/finance/reports/export?reportType=commissions_consolidated&format=xlsx&token=mock-master-token" class="btn-export btn-xlsx">📊 Excel (XLSX)</a>
            <a href="/api/finance/reports/export?reportType=commissions_consolidated&format=pdf&token=mock-master-token" target="_blank" class="btn-export btn-pdf">📄 PDF Data</a>
          </div>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Agent Partner</th>
                <th>Candidate</th>
                <th>Course</th>
                <th>Course Fee</th>
                <th>Rate</th>
                <th>Commission Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${commissions.commissions.map((c: any) => `
                <tr>
                  <td><strong>${c.agentName}</strong><br><small style="color:var(--text-muted)">${c.referralCode || 'REFAGENT123'}</small></td>
                  <td>${c.seafarerName}</td>
                  <td>${c.courseName}</td>
                  <td>₹${c.courseFee.toLocaleString('en-IN')}</td>
                  <td><span class="code-tag">${c.commissionRate}%</span></td>
                  <td><strong style="color:var(--accent-emerald)">₹${c.commissionAmount.toLocaleString('en-IN')}</strong></td>
                  <td><span class="status-badge ${c.status === 'Paid' ? 'status-paid' : 'status-pending'}">${c.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 4: INVOICES -->
    <div id="tab-invoices" class="tab-pane">
      <div class="card-section">
        <div class="section-header">
          <div class="section-title">📑 Invoices Ledger (${invoices.invoices.length} records)</div>
          <div class="export-btns">
            <a href="/api/finance/reports/export?reportType=invoices_summary&format=csv&token=mock-master-token" class="btn-export btn-csv">📥 Export CSV</a>
            <a href="/api/finance/reports/export?reportType=invoices_summary&format=xlsx&token=mock-master-token" class="btn-export btn-xlsx">📊 Excel (XLSX)</a>
            <a href="/api/finance/reports/export?reportType=invoices_summary&format=pdf&token=mock-master-token" target="_blank" class="btn-export btn-pdf">📄 PDF Data</a>
          </div>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Type</th>
                <th>Customer</th>
                <th>Course</th>
                <th>Amount</th>
                <th>Est. GST (18%)</th>
                <th>Transaction ID</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${invoices.invoices.map((inv: any) => `
                <tr>
                  <td><span class="code-tag">${inv.invoiceNumber}</span></td>
                  <td><span class="status-badge ${inv.invoiceType === 'HOC' ? 'status-hoc' : 'status-hac'}">${inv.invoiceType}</span></td>
                  <td><strong>${inv.customerName}</strong><br><small style="color:var(--text-muted)">${inv.customerEmail}</small></td>
                  <td>${inv.courseName}</td>
                  <td><strong>₹${inv.finalAmount.toLocaleString('en-IN')}</strong></td>
                  <td>₹${inv.taxAmount.toLocaleString('en-IN')}</td>
                  <td><span class="code-tag">${inv.transactionId}</span></td>
                  <td><span class="status-badge status-paid">Paid</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 5: SETTLEMENTS -->
    <div id="tab-settlements" class="tab-pane">
      <div class="card-section">
        <div class="section-header">
          <div class="section-title">💰 Settlement Batches & Disbursement History</div>
          <div class="export-btns">
            <a href="/api/finance/reports/export?reportType=settlements_history&format=csv&token=mock-master-token" class="btn-export btn-csv">📥 Export CSV</a>
            <a href="/api/finance/reports/export?reportType=settlements_history&format=xlsx&token=mock-master-token" class="btn-export btn-xlsx">📊 Excel (XLSX)</a>
            <a href="/api/finance/reports/export?reportType=settlements_history&format=pdf&token=mock-master-token" target="_blank" class="btn-export btn-pdf">📄 PDF Data</a>
          </div>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Settlement #</th>
                <th>Agent Partner</th>
                <th>Linked HAC Invoice</th>
                <th>Total Disbursed</th>
                <th>Status</th>
                <th>Disbursed Date</th>
              </tr>
            </thead>
            <tbody>
              ${settlements.settlements.map((s: any) => `
                <tr>
                  <td><span class="code-tag">${s.settlementNumber}</span></td>
                  <td><strong>${s.agentName}</strong></td>
                  <td><span class="code-tag">${s.hacInvoiceNumber || 'N/A'}</span></td>
                  <td><strong style="color:var(--accent-emerald)">₹${s.totalAmount.toLocaleString('en-IN')}</strong></td>
                  <td><span class="status-badge status-paid">${s.status}</span></td>
                  <td>${s.paidAt ? new Date(s.paidAt).toLocaleDateString('en-IN') : 'Pending'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 6: AUDIT LOGS -->
    <div id="tab-audit" class="tab-pane">
      <div class="card-section">
        <div class="section-header">
          <div class="section-title">🛡️ Section 7.8 Immutable Financial Audit Trail</div>
          <div class="search-bar">
            <span>🔍</span>
            <input type="text" id="auditSearchInput" placeholder="Search actions, users, IDs..." onkeyup="filterAuditLogs()">
          </div>
        </div>
        <div class="table-container">
          <table id="auditTable">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Module</th>
                <th>Entity ID</th>
                <th>Details</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody>
              ${auditLogs.logs.map((log: any) => `
                <tr>
                  <td><small style="color:var(--text-muted)">${new Date(log.created_at).toLocaleString('en-IN')}</small></td>
                  <td><strong>${log.user_name || 'System'}</strong></td>
                  <td><span class="code-tag" style="color:var(--accent-emerald)">${log.action}</span></td>
                  <td>${log.module}</td>
                  <td><span class="code-tag">${log.entity_id || 'N/A'}</span></td>
                  <td>${log.details || ''}</td>
                  <td><small style="color:var(--text-muted)">${log.ip_address || '127.0.0.1'}</small></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <footer>
      Hari Om Thalassic Maritime Training Institute | Centralized Financial Control Center (Chapter 7) | Confidential
    </footer>
  </div>

  <script>
    function switchTab(btn, tabId) {
      document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
      const targetPane = document.getElementById(tabId);
      if (targetPane) targetPane.classList.add('active');
      if (btn) btn.classList.add('active');
    }

    function filterAuditLogs() {
      const input = document.getElementById('auditSearchInput');
      const filter = input.value.toLowerCase();
      const rows = document.querySelectorAll('#auditTable tbody tr');
      rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(filter) ? '' : 'none';
      });
    }
  </script>
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
  // 4. Commission Reports
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
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.send(result.data);
    } else if (dto.format === 'xlsx') {
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.send(result.data);
    } else {
      // PDF Data Model Structure response
      return res.json(result);
    }
  }

  // =========================================================================
  // 8. Section 7.8 Financial Audit Logs
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
  logFinancialActivity(@Body() dto: CreateFinancialAuditLogDto, @Req() req: Request) {
    const user = (req as any).user;
    return this.financeService.logFinancialActivity(dto, user);
  }

  // Immutability Violations (Strict PRD 7.8 Protection)
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
