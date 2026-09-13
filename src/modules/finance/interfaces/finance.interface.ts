export type ReportPeriod = 'daily' | 'monthly' | 'annual' | 'custom';

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
  | 'settlements_consolidated'
  | 'finance_overview';

export type ExportFormat = 'pdf' | 'xlsx' | 'csv';

export type FinancialActivity =
  | 'PAYMENT_RECEIVED'
  | 'INVOICE_GENERATED'
  | 'COMMISSION_APPROVED'
  | 'COMMISSION_MODIFIED'
  | 'SETTLEMENT_APPROVED'
  | 'SETTLEMENT_COMPLETED'
  | 'INVOICE_RESENT'
  | 'REPORT_EXPORTED';

export type FinancialModuleType =
  | 'Finance'
  | 'Payments'
  | 'Invoices'
  | 'Commissions'
  | 'Settlements'
  | 'Reports'
  | 'General';

export interface AuditLogEntry {
  id: string;
  user_id?: string | null;
  user_name?: string | null;
  action: string;
  module: string;
  entity_id?: string | null;
  company_id?: string | null;
  details?: string | null;
  previous_value?: any;
  updated_value?: any;
  ip_address?: string | null;
  created_at: string;
}

export interface RevenueMetricItem {
  period: string;
  dateKey: string;
  grossRevenue: number;
  discountAmount: number;
  netRevenue: number;
  transactionCount: number;
  averageTicketSize: number;
  coursesCount?: number;
  growthRatePercent?: number | null;
}

export interface RevenueReportData {
  reportTitle: string;
  generatedAt: string;
  currency: string;
  summary: {
    totalGrossRevenue: number;
    totalDiscount: number;
    totalNetRevenue: number;
    totalTransactions: number;
    averageOrderValue: number;
    formattedTotalGross: string;
    formattedTotalNet: string;
  };
  breakdown: RevenueMetricItem[];
}

export interface PaymentItem {
  id: string;
  transactionId: string;
  invoiceNumber?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  courseName: string;
  amount: number;
  formattedAmount: string;
  paymentGateway: string;
  paymentMethod: string;
  status: 'Successful' | 'Failed' | 'Pending';
  failureReason?: string;
  createdAt: string;
  completedAt?: string;
}

export interface PaymentReportData {
  reportTitle: string;
  generatedAt: string;
  summary: {
    totalTransactions: number;
    successfulCount: number;
    failedCount: number;
    pendingCount: number;
    successRatePercent: number;
    totalSuccessfulVolume: number;
    totalPendingVolume: number;
    formattedSuccessfulVolume: string;
  };
  payments: PaymentItem[];
}

export interface CommissionItem {
  id: string;
  agentId: string;
  agentName: string;
  agentEmail?: string;
  referralCode?: string;
  purchaseId: string;
  seafarerName: string;
  courseName: string;
  courseFee: number;
  commissionRate: number;
  commissionAmount: number;
  formattedCourseFee: string;
  formattedCommissionAmount: string;
  commissionSource: string;
  status: 'Pending' | 'Approved' | 'Settled' | 'Paid' | 'Under Review' | 'Cancelled';
  settlementId?: string;
  createdAt: string;
  settledAt?: string;
}

export interface CommissionReportData {
  reportTitle: string;
  generatedAt: string;
  summary: {
    totalCommissionsCount: number;
    pendingCount: number;
    paidCount: number;
    outstandingCount: number; // Approved commissions awaiting settlement
    totalCommissionPayable: number;
    totalCommissionPaid: number;
    formattedCommissionPayable: string;
    formattedCommissionPaid: string;
    averageCommissionRate: number;
  };
  commissions: CommissionItem[];
}

export interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  invoiceType: 'HOC' | 'HAC';
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  agentName?: string;
  agentReferralCode?: string;
  courseName: string;
  courseFee: number;
  discount: number;
  finalAmount: number;
  taxAmount: number;
  formattedFinalAmount: string;
  paymentGateway: string;
  paymentMethod: string;
  transactionId: string;
  status: string;
  createdAt: string;
}

export interface InvoiceReportData {
  reportTitle: string;
  generatedAt: string;
  summary: {
    totalInvoices: number;
    hocCount: number;
    hacCount: number;
    totalInvoicedAmount: number;
    totalDiscounts: number;
    totalNetCollections: number;
    totalTaxEstimated: number;
    formattedInvoicedAmount: string;
    formattedNetCollections: string;
  };
  invoices: InvoiceItem[];
}

export interface SettlementItem {
  id: string;
  settlementNumber: string;
  agentId: string;
  agentName: string;
  hacInvoiceNumber?: string;
  totalAmount: number;
  formattedTotalAmount: string;
  commissionCount?: number;
  status: 'Pending' | 'Approved' | 'Paid';
  createdAt: string;
  paidAt?: string | null;
}

export interface SettlementReportData {
  reportTitle: string;
  generatedAt: string;
  summary: {
    totalSettlements: number;
    pendingSettlementsCount: number;
    paidSettlementsCount: number;
    totalPendingAmount: number;
    totalPaidAmount: number;
    formattedPendingAmount: string;
    formattedPaidAmount: string;
  };
  settlements: SettlementItem[];
}

export interface FinanceOverviewData {
  generatedAt: string;
  kpis: {
    grossPlatformRevenue: number;
    formattedGrossPlatformRevenue: string;
    netPlatformRevenue: number;
    formattedNetPlatformRevenue: string;
    totalCommissionsPaid: number;
    formattedTotalCommissionsPaid: string;
    outstandingCommissionPayables: number;
    formattedOutstandingCommissionPayables: string;
    totalSettlementsPaid: number;
    formattedTotalSettlementsPaid: string;
    pendingSettlementsAmount: number;
    formattedPendingSettlementsAmount: string;
    totalInvoicesGenerated: number;
    paymentSuccessRate: string;
  };
  recentActivities: AuditLogEntry[];
  revenueTrend: {
    last7Days: RevenueMetricItem[];
    last6Months: RevenueMetricItem[];
  };
}
