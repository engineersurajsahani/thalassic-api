export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export type ReportType =
  | 'revenue_daily'
  | 'revenue_monthly'
  | 'revenue_annual'
  | 'revenue_consolidated'
  | 'payments_successful'
  | 'payments_failed'
  | 'payments_pending'
  | 'payments_consolidated'
  | 'commissions_pending'
  | 'commissions_paid'
  | 'commissions_outstanding'
  | 'commissions_consolidated'
  | 'invoices_hoc'
  | 'invoices_hac'
  | 'invoices_summary'
  | 'invoices_consolidated'
  | 'settlements_pending'
  | 'settlements_paid'
  | 'settlements_history'
  | 'settlements_consolidated';

export interface RevenueMetricItem {
  period: string;
  hocRevenue: number;
  hacRevenue: number;
  companyRevenue: number;
  totalRevenue: number;
  transactionCount: number;
  partnerPayablesTotal: number;
  netInstituteRevenue: number;
}

export interface RevenueReportData {
  title: string;
  reportType: 'daily' | 'monthly' | 'annual' | 'consolidated';
  generatedAt: string;
  summary: {
    totalRevenue: number;
    hocRevenue: number;
    hacRevenue: number;
    companyRevenue: number;
    totalPartnerPayables: number;
    netInstituteRevenue: number;
    totalTransactions: number;
  };
  metrics: RevenueMetricItem[];
}

export interface PaymentItem {
  id: string;
  paymentNumber: string;
  invoiceNumber: string;
  invoiceType: string;
  customerName: string;
  customerEmail: string;
  partnerName: string | null;
  amount: number;
  paymentMethod: string;
  transactionId: string;
  status: string;
  paidAt: string;
}

export interface PaymentReportData {
  title: string;
  filter: string;
  generatedAt: string;
  summary: {
    totalAmount: number;
    totalCount: number;
    successCount: number;
    failedCount: number;
    pendingCount: number;
  };
  payments: PaymentItem[];
}

export interface PartnerPayableItem {
  id: string;
  partnerId: string;
  partnerName: string;
  seafarerName: string;
  courseName: string;
  approvedPayableAmount: number;
  invoiceNumber: string;
  status: string;
  createdAt: string;
  settledAt: string | null;
}

export interface PartnerPayableReportData {
  title: string;
  filter: string;
  generatedAt: string;
  summary: {
    totalPayablesAmount: number;
    totalCount: number;
    pendingCount: number;
    settledCount: number;
  };
  payables: PartnerPayableItem[];
}

export interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  invoiceType: string;
  customerName: string;
  customerEmail: string;
  partnerName: string | null;
  companyName: string | null;
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  netPayable: number;
  status: string;
  createdAt: string;
  paidDate: string | null;
}

export interface InvoiceReportData {
  title: string;
  invoiceType: string;
  generatedAt: string;
  summary: {
    totalInvoices: number;
    totalNetBilled: number;
    totalPaid: number;
    totalOutstanding: number;
  };
  invoices: InvoiceItem[];
}

export interface SettlementReportItem {
  id: string;
  settlementNumber: string;
  partnerId: string;
  partnerName: string;
  totalAmount: number;
  totalItems: number;
  status: string;
  paymentReference: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface SettlementReportData {
  title: string;
  filter: string;
  generatedAt: string;
  summary: {
    totalSettledAmount: number;
    totalCount: number;
    pendingCount: number;
    paidCount: number;
  };
  settlements: SettlementReportItem[];
}

export interface FinanceOverviewData {
  totalRevenue: number;
  hocRevenue: number;
  hacRevenue: number;
  companyRevenue: number;
  totalPartnerPayables: number;
  totalSettledAmount: number;
  pendingSettlementsAmount: number;
  totalInvoicesCount: number;
  totalPaymentsCount: number;
  recentTransactions: any[];
}
