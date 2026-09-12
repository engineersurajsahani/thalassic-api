import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Invoice,
  InvoiceType,
  InvoiceStatus,
  Payment,
  PaymentStatus,
  PartnerPayable,
  PayableStatus,
  Settlement,
  SettlementStatus,
  Partner,
} from '../../entities';
import {
  RevenueReportData,
  PaymentReportData,
  PartnerPayableReportData,
  InvoiceReportData,
  SettlementReportData,
  FinanceOverviewData,
} from './interfaces/finance.interface';
import { ReportQueryDto } from './dto/finance.dto';

@Injectable()
export class FinanceReportsService {
  private readonly logger = new Logger(FinanceReportsService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(PartnerPayable)
    private readonly payableRepo: Repository<PartnerPayable>,
    @InjectRepository(Settlement)
    private readonly settlementRepo: Repository<Settlement>,
    @InjectRepository(Partner)
    private readonly partnerRepo: Repository<Partner>,
  ) {}

  // =========================================================================
  // 1. EXECUTIVE DASHBOARD OVERVIEW
  // =========================================================================
  async getFinanceOverview(): Promise<FinanceOverviewData> {
    const invoices = await this.invoiceRepo.find({
      relations: {
        user: true,
        partner: true,
        company: true,
        enrollment: {
          courseInstitute: {
            course: true,
          },
        },
      },
      order: { createdAt: 'DESC' },
    });

    const payments = await this.paymentRepo.find({
      where: { status: PaymentStatus.SUCCESSFUL },
    });

    const payables = await this.payableRepo.find();
    const settlements = await this.settlementRepo.find();

    const hocRevenue = invoices
      .filter(
        (i) =>
          i.invoiceType === InvoiceType.HOC && i.status === InvoiceStatus.PAID,
      )
      .reduce((sum, i) => sum + Number(i.netPayable), 0);

    const hacRevenue = invoices
      .filter(
        (i) =>
          i.invoiceType === InvoiceType.HAC && i.status === InvoiceStatus.PAID,
      )
      .reduce((sum, i) => sum + Number(i.netPayable), 0);

    const companyRevenue = invoices
      .filter(
        (i) =>
          i.invoiceType === InvoiceType.COMPANY &&
          i.status === InvoiceStatus.PAID,
      )
      .reduce((sum, i) => sum + Number(i.netPayable), 0);

    const totalRevenue = hocRevenue + hacRevenue + companyRevenue;

    const totalPartnerPayables = payables.reduce(
      (sum, p) => sum + Number(p.approvedPayableAmount),
      0,
    );

    const totalSettledAmount = settlements
      .filter((s) => s.status === SettlementStatus.PAID)
      .reduce((sum, s) => sum + Number(s.totalAmount), 0);

    const pendingSettlementsAmount = settlements
      .filter((s) => s.status === SettlementStatus.PENDING)
      .reduce((sum, s) => sum + Number(s.totalAmount), 0);

    const recentTransactions = invoices.slice(0, 10).map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceType: inv.invoiceType,
      customerName: inv.user?.name || 'Seafarer',
      amount: Number(inv.netPayable),
      status: inv.status,
      date: inv.paidDate || inv.createdAt,
    }));

    return {
      totalRevenue,
      hocRevenue,
      hacRevenue,
      companyRevenue,
      totalPartnerPayables,
      totalSettledAmount,
      pendingSettlementsAmount,
      totalInvoicesCount: invoices.length,
      totalPaymentsCount: payments.length,
      recentTransactions,
    };
  }

  // =========================================================================
  // 2. REVENUE REPORTS
  // =========================================================================
  async getDailyRevenueReport(
    query: ReportQueryDto = {},
  ): Promise<RevenueReportData> {
    return this.generateRevenueReport('daily', 'Daily Revenue Report', query);
  }

  async getMonthlyRevenueReport(
    query: ReportQueryDto = {},
  ): Promise<RevenueReportData> {
    return this.generateRevenueReport(
      'monthly',
      'Monthly Revenue Report',
      query,
    );
  }

  async getAnnualRevenueReport(
    query: ReportQueryDto = {},
  ): Promise<RevenueReportData> {
    return this.generateRevenueReport('annual', 'Annual Revenue Report', query);
  }

  async getConsolidatedRevenueReport(
    query: ReportQueryDto = {},
  ): Promise<RevenueReportData> {
    return this.generateRevenueReport(
      'consolidated',
      'Consolidated Revenue Report',
      query,
    );
  }

  private async generateRevenueReport(
    reportType: 'daily' | 'monthly' | 'annual' | 'consolidated',
    title: string,
    query: ReportQueryDto,
  ): Promise<RevenueReportData> {
    const qb = this.invoiceRepo
      .createQueryBuilder('inv')
      .where('inv.status = :status', { status: InvoiceStatus.PAID });

    if (query.startDate) {
      qb.andWhere('inv.createdAt >= :startDate', {
        startDate: new Date(query.startDate),
      });
    }
    if (query.endDate) {
      qb.andWhere('inv.createdAt <= :endDate', {
        endDate: new Date(query.endDate),
      });
    }

    const invoices = await qb.getMany();

    const periodMap = new Map<string, any>();

    for (const inv of invoices) {
      const d = new Date(inv.createdAt);
      let period = '';
      if (reportType === 'daily') {
        period = d.toISOString().split('T')[0];
      } else if (reportType === 'monthly') {
        period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else {
        period = `${d.getFullYear()}`;
      }

      if (!periodMap.has(period)) {
        periodMap.set(period, {
          period,
          hocRevenue: 0,
          hacRevenue: 0,
          companyRevenue: 0,
          totalRevenue: 0,
          transactionCount: 0,
          partnerPayablesTotal: 0,
          netInstituteRevenue: 0,
        });
      }

      const item = periodMap.get(period);
      const amt = Number(inv.netPayable);
      if (inv.invoiceType === InvoiceType.HOC) item.hocRevenue += amt;
      else if (inv.invoiceType === InvoiceType.HAC) item.hacRevenue += amt;
      else if (inv.invoiceType === InvoiceType.COMPANY)
        item.companyRevenue += amt;

      item.totalRevenue += amt;
      item.netInstituteRevenue += amt;
      item.transactionCount += 1;
    }

    const metrics = Array.from(periodMap.values()).sort((a, b) =>
      b.period.localeCompare(a.period),
    );

    const hocTotal = metrics.reduce((s, m) => s + m.hocRevenue, 0);
    const hacTotal = metrics.reduce((s, m) => s + m.hacRevenue, 0);
    const compTotal = metrics.reduce((s, m) => s + m.companyRevenue, 0);
    const totalRev = hocTotal + hacTotal + compTotal;
    const txCount = metrics.reduce((s, m) => s + m.transactionCount, 0);

    return {
      title,
      reportType,
      generatedAt: new Date().toISOString(),
      summary: {
        totalRevenue: totalRev,
        hocRevenue: hocTotal,
        hacRevenue: hacTotal,
        companyRevenue: compTotal,
        totalPartnerPayables: 0,
        netInstituteRevenue: totalRev,
        totalTransactions: txCount,
      },
      metrics,
    };
  }

  // =========================================================================
  // 3. PAYMENT REPORTS
  // =========================================================================
  async getSuccessfulPaymentsReport(
    query: ReportQueryDto = {},
  ): Promise<PaymentReportData> {
    return this.generatePaymentReport('Successful', query);
  }

  async getFailedPaymentsReport(
    query: ReportQueryDto = {},
  ): Promise<PaymentReportData> {
    return this.generatePaymentReport('Failed', query);
  }

  async getPendingPaymentsReport(
    query: ReportQueryDto = {},
  ): Promise<PaymentReportData> {
    return this.generatePaymentReport('Pending', query);
  }

  async getConsolidatedPaymentsReport(
    query: ReportQueryDto = {},
  ): Promise<PaymentReportData> {
    return this.generatePaymentReport('All', query);
  }

  private async generatePaymentReport(
    filter: string,
    query: ReportQueryDto,
  ): Promise<PaymentReportData> {
    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.invoice', 'inv')
      .leftJoinAndSelect('p.user', 'user')
      .leftJoinAndSelect('p.partner', 'partner')
      .orderBy('p.createdAt', 'DESC');

    if (filter !== 'All') {
      qb.andWhere('p.status = :status', { status: filter as PaymentStatus });
    }
    if (query.startDate) {
      qb.andWhere('p.createdAt >= :startDate', {
        startDate: new Date(query.startDate),
      });
    }
    if (query.endDate) {
      qb.andWhere('p.createdAt <= :endDate', {
        endDate: new Date(query.endDate),
      });
    }

    const payments = await qb.getMany();

    const paymentItems = payments.map((p) => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      invoiceNumber: p.invoice?.invoiceNumber || 'N/A',
      invoiceType: p.invoice?.invoiceType || 'DIRECT',
      customerName: p.user?.name || 'Candidate',
      customerEmail: p.user?.email || '',
      partnerName: p.partner?.agencyName || null,
      amount: Number(p.amount),
      paymentMethod: p.paymentMethod,
      transactionId: p.gatewayTransactionId || p.paymentNumber,
      status: p.status,
      paidAt: p.paidAt?.toISOString() || p.createdAt.toISOString(),
    }));

    const totalAmount = paymentItems.reduce((s, p) => s + p.amount, 0);
    const successCount = paymentItems.filter(
      (p) => p.status === PaymentStatus.SUCCESSFUL,
    ).length;
    const failedCount = paymentItems.filter(
      (p) => p.status === PaymentStatus.FAILED,
    ).length;
    const pendingCount = paymentItems.filter(
      (p) => p.status === PaymentStatus.PENDING,
    ).length;

    return {
      title: `${filter} Payments Report`,
      filter,
      generatedAt: new Date().toISOString(),
      summary: {
        totalAmount,
        totalCount: paymentItems.length,
        successCount,
        failedCount,
        pendingCount,
      },
      payments: paymentItems,
    };
  }

  // =========================================================================
  // 4. PARTNER PAYABLE REPORTS (REPLACES COMMISSIONS)
  // =========================================================================
  async getPendingCommissionsReport(
    query: ReportQueryDto = {},
  ): Promise<PartnerPayableReportData> {
    return this.generatePartnerPayablesReport('Pending', query);
  }

  async getPaidCommissionsReport(
    query: ReportQueryDto = {},
  ): Promise<PartnerPayableReportData> {
    return this.generatePartnerPayablesReport('Settled', query);
  }

  async getOutstandingCommissionsReport(
    query: ReportQueryDto = {},
  ): Promise<PartnerPayableReportData> {
    return this.generatePartnerPayablesReport('Approved', query);
  }

  async getConsolidatedCommissionsReport(
    query: ReportQueryDto = {},
  ): Promise<PartnerPayableReportData> {
    return this.generatePartnerPayablesReport('All', query);
  }

  private async generatePartnerPayablesReport(
    filter: string,
    query: ReportQueryDto,
  ): Promise<PartnerPayableReportData> {
    const qb = this.payableRepo
      .createQueryBuilder('pp')
      .leftJoinAndSelect('pp.partner', 'partner')
      .leftJoinAndSelect('pp.course', 'course')
      .leftJoinAndSelect('pp.seafarerUser', 'user')
      .leftJoinAndSelect('pp.invoice', 'inv')
      .orderBy('pp.createdAt', 'DESC');

    if (filter !== 'All') {
      qb.andWhere('pp.status = :status', { status: filter as PayableStatus });
    }
    if (query.startDate) {
      qb.andWhere('pp.createdAt >= :startDate', {
        startDate: new Date(query.startDate),
      });
    }
    if (query.endDate) {
      qb.andWhere('pp.createdAt <= :endDate', {
        endDate: new Date(query.endDate),
      });
    }

    const payables = await qb.getMany();

    const items = payables.map((pp) => ({
      id: pp.id,
      partnerId: pp.partnerId,
      partnerName: pp.partner?.agencyName || 'Partner Agency',
      seafarerName: pp.seafarerUser?.name || 'Seafarer',
      courseName: pp.course?.name || 'Course',
      approvedPayableAmount: Number(pp.approvedPayableAmount),
      invoiceNumber: pp.invoice?.invoiceNumber || 'N/A',
      status: pp.status,
      createdAt: pp.createdAt.toISOString(),
      settledAt:
        pp.status === PayableStatus.SETTLED ? pp.updatedAt.toISOString() : null,
    }));

    const totalAmount = items.reduce((s, p) => s + p.approvedPayableAmount, 0);
    const pendingCount = items.filter(
      (p) => p.status === PayableStatus.PENDING,
    ).length;
    const settledCount = items.filter(
      (p) => p.status === PayableStatus.SETTLED,
    ).length;

    return {
      title: `${filter} Partner Payables Report`,
      filter,
      generatedAt: new Date().toISOString(),
      summary: {
        totalPayablesAmount: totalAmount,
        totalCount: items.length,
        pendingCount,
        settledCount,
      },
      payables: items,
    };
  }

  // =========================================================================
  // 5. INVOICE REPORTS
  // =========================================================================
  async getHocInvoicesReport(
    query: ReportQueryDto = {},
  ): Promise<InvoiceReportData> {
    return this.generateInvoiceReport(InvoiceType.HOC, query);
  }

  async getHacInvoicesReport(
    query: ReportQueryDto = {},
  ): Promise<InvoiceReportData> {
    return this.generateInvoiceReport(InvoiceType.HAC, query);
  }

  async getInvoiceSummaryReport(
    query: ReportQueryDto = {},
  ): Promise<InvoiceReportData> {
    return this.generateInvoiceReport('SUMMARY', query);
  }

  async getConsolidatedInvoicesReport(
    query: ReportQueryDto = {},
  ): Promise<InvoiceReportData> {
    return this.generateInvoiceReport('ALL', query);
  }

  private async generateInvoiceReport(
    invType: string,
    query: ReportQueryDto,
  ): Promise<InvoiceReportData> {
    const qb = this.invoiceRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.user', 'user')
      .leftJoinAndSelect('inv.partner', 'partner')
      .leftJoinAndSelect('inv.company', 'company')
      .orderBy('inv.createdAt', 'DESC');

    if (invType === 'HOC' || invType === 'HAC' || invType === 'COMPANY') {
      qb.andWhere('inv.invoiceType = :type', { type: invType as InvoiceType });
    }
    if (query.startDate) {
      qb.andWhere('inv.createdAt >= :startDate', {
        startDate: new Date(query.startDate),
      });
    }
    if (query.endDate) {
      qb.andWhere('inv.createdAt <= :endDate', {
        endDate: new Date(query.endDate),
      });
    }

    const invoices = await qb.getMany();

    const items = invoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      invoiceType: i.invoiceType,
      customerName: i.user?.name || 'Walk-in Seafarer',
      customerEmail: i.user?.email || '',
      partnerName: i.partner?.agencyName || null,
      companyName: i.company?.name || null,
      totalAmount: Number(i.totalAmount),
      taxAmount: Number(i.taxAmount),
      discountAmount: Number(i.discountAmount),
      netPayable: Number(i.netPayable),
      status: i.status,
      createdAt: i.createdAt.toISOString(),
      paidDate: i.paidDate || null,
    }));

    const totalNetBilled = items.reduce((s, i) => s + i.netPayable, 0);
    const totalPaid = items
      .filter((i) => i.status === InvoiceStatus.PAID)
      .reduce((s, i) => s + i.netPayable, 0);
    const totalOutstanding = items
      .filter((i) => i.status !== InvoiceStatus.PAID)
      .reduce((s, i) => s + i.netPayable, 0);

    return {
      title: `${invType} Invoices Report`,
      invoiceType: invType,
      generatedAt: new Date().toISOString(),
      summary: {
        totalInvoices: items.length,
        totalNetBilled,
        totalPaid,
        totalOutstanding,
      },
      invoices: items,
    };
  }

  // =========================================================================
  // 6. SETTLEMENT REPORTS
  // =========================================================================
  async getPendingSettlementsReport(
    query: ReportQueryDto = {},
  ): Promise<SettlementReportData> {
    return this.generateSettlementReport('Pending', query);
  }

  async getPaidSettlementsReport(
    query: ReportQueryDto = {},
  ): Promise<SettlementReportData> {
    return this.generateSettlementReport('Paid', query);
  }

  async getSettlementHistoryReport(
    query: ReportQueryDto = {},
  ): Promise<SettlementReportData> {
    return this.generateSettlementReport('All', query);
  }

  async getConsolidatedSettlementsReport(
    query: ReportQueryDto = {},
  ): Promise<SettlementReportData> {
    return this.generateSettlementReport('All', query);
  }

  private async generateSettlementReport(
    filter: string,
    query: ReportQueryDto,
  ): Promise<SettlementReportData> {
    const qb = this.settlementRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.partner', 'partner')
      .orderBy('s.createdAt', 'DESC');

    if (filter !== 'All') {
      qb.andWhere('s.status = :status', { status: filter as SettlementStatus });
    }
    if (query.startDate) {
      qb.andWhere('s.createdAt >= :startDate', {
        startDate: new Date(query.startDate),
      });
    }
    if (query.endDate) {
      qb.andWhere('s.createdAt <= :endDate', {
        endDate: new Date(query.endDate),
      });
    }

    const settlements = await qb.getMany();

    const items = settlements.map((s) => ({
      id: s.id,
      settlementNumber: s.settlementNumber,
      partnerId: s.partnerId,
      partnerName: s.partner?.agencyName || 'Partner Agency',
      totalAmount: Number(s.totalAmount),
      totalItems: s.totalItems,
      status: s.status,
      paymentReference: s.paymentReference,
      processedAt: s.processedAt?.toISOString() || null,
      createdAt: s.createdAt.toISOString(),
    }));

    const totalSettledAmount = items
      .filter((s) => s.status === SettlementStatus.PAID)
      .reduce((sum, s) => sum + s.totalAmount, 0);

    const pendingCount = items.filter(
      (s) => s.status === SettlementStatus.PENDING,
    ).length;
    const paidCount = items.filter(
      (s) => s.status === SettlementStatus.PAID,
    ).length;

    return {
      title: `${filter} Settlements Report`,
      filter,
      generatedAt: new Date().toISOString(),
      summary: {
        totalSettledAmount,
        totalCount: items.length,
        pendingCount,
        paidCount,
      },
      settlements: items,
    };
  }
}
