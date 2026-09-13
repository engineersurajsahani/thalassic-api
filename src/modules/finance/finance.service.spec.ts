import { Test, TestingModule } from '@nestjs/testing';
import { FinanceService } from './finance.service';
import { FinanceReportsService } from './finance-reports.service';
import { FinanceAuditService } from './finance-audit.service';
import { FinanceExportService } from './finance-export.service';
import { SupabaseService } from '../supabase/supabase.service';
import { BadRequestException } from '@nestjs/common';

import { getRepositoryToken } from '@nestjs/typeorm';
import {
  Invoice,
  Payment,
  PartnerPayable,
  Settlement,
  Partner,
  AuditLog,
  User,
} from '../../entities';

const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue([]),
  getManyAndCount: jest
    .fn()
    .mockResolvedValue([
      [
        {
          id: 'log-1',
          action: 'PAYMENT_RECEIVED',
          entityId: 'TXN-TEST-999',
          createdAt: new Date(),
        },
      ],
      1,
    ]),
};

const mockRepo = {
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  create: jest
    .fn()
    .mockImplementation((dto) => ({
      id: 'log-1',
      createdAt: new Date(),
      ...dto,
    })),
  save: jest
    .fn()
    .mockImplementation((dto) =>
      Promise.resolve({ id: 'log-1', createdAt: new Date(), ...dto }),
    ),
  createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
};

describe('FinanceService & Financial Reports (Chapter 7)', () => {
  let financeService: FinanceService;
  let reportsService: FinanceReportsService;
  let auditService: FinanceAuditService;
  let exportService: FinanceExportService;

  const mockSupabaseClient = {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
      limit: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
    }),
  };

  const mockSupabaseService = {
    getClient: jest.fn().mockReturnValue(mockSupabaseClient),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        FinanceReportsService,
        FinanceAuditService,
        FinanceExportService,
        { provide: getRepositoryToken(Invoice), useValue: mockRepo },
        { provide: getRepositoryToken(Payment), useValue: mockRepo },
        { provide: getRepositoryToken(PartnerPayable), useValue: mockRepo },
        { provide: getRepositoryToken(Settlement), useValue: mockRepo },
        { provide: getRepositoryToken(Partner), useValue: mockRepo },
        { provide: getRepositoryToken(AuditLog), useValue: mockRepo },
        { provide: getRepositoryToken(User), useValue: mockRepo },
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    financeService = module.get<FinanceService>(FinanceService);
    reportsService = module.get<FinanceReportsService>(FinanceReportsService);
    auditService = module.get<FinanceAuditService>(FinanceAuditService);
    exportService = module.get<FinanceExportService>(FinanceExportService);
  });

  it('should be defined', () => {
    expect(financeService).toBeDefined();
    expect(reportsService).toBeDefined();
    expect(auditService).toBeDefined();
    expect(exportService).toBeDefined();
  });

  describe('Revenue Reports', () => {
    it('should generate daily revenue report with valid structure and totals', async () => {
      const report = await financeService.getDailyRevenue({});
      expect(report).toBeDefined();
      expect(report.title).toContain('Revenue');
      expect(report.summary).toBeDefined();
      expect(Array.isArray(report.metrics)).toBe(true);
    });

    it('should generate monthly revenue report with valid structure', async () => {
      const report = await financeService.getMonthlyRevenue({});
      expect(report).toBeDefined();
      expect(report.title).toContain('Revenue');
      expect(report.summary).toBeDefined();
      expect(Array.isArray(report.metrics)).toBe(true);
    });

    it('should generate annual revenue report with valid structure', async () => {
      const report = await financeService.getAnnualRevenue({});
      expect(report).toBeDefined();
      expect(report.title).toContain('Revenue');
      expect(report.summary).toBeDefined();
      expect(Array.isArray(report.metrics)).toBe(true);
    });
  });

  describe('Payment Reports', () => {
    it('should generate successful payments report', async () => {
      const report = await financeService.getSuccessfulPayments({});
      expect(report).toBeDefined();
      expect(report.title).toContain('Successful');
      expect(report.summary.totalCount).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(report.payments)).toBe(true);
    });

    it('should generate failed payments report', async () => {
      const report = await financeService.getFailedPayments({});
      expect(report).toBeDefined();
      expect(report.title).toContain('Failed');
      expect(Array.isArray(report.payments)).toBe(true);
    });

    it('should generate pending payments report', async () => {
      const report = await financeService.getPendingPayments({});
      expect(report).toBeDefined();
      expect(report.title).toContain('Pending');
      expect(Array.isArray(report.payments)).toBe(true);
    });
  });

  describe('Commission Reports', () => {
    it('should generate pending commissions report', async () => {
      const report = await financeService.getPendingCommissions({});
      expect(report).toBeDefined();
      expect(report.title).toContain('Partner Payables');
      expect(Array.isArray(report.payables)).toBe(true);
    });

    it('should generate paid commissions report', async () => {
      const report = await financeService.getPaidCommissions({});
      expect(report).toBeDefined();
      expect(report.title).toContain('Partner Payables');
      expect(Array.isArray(report.payables)).toBe(true);
    });

    it('should generate outstanding commissions report', async () => {
      const report = await financeService.getOutstandingCommissions({});
      expect(report).toBeDefined();
      expect(report.title).toContain('Partner Payables');
      expect(Array.isArray(report.payables)).toBe(true);
    });
  });

  describe('Invoice Reports', () => {
    it('should generate HOC invoices report for direct student purchases', async () => {
      const report = await financeService.getHocInvoices({});
      expect(report).toBeDefined();
      expect(report.title).toContain('HOC');
      expect(Array.isArray(report.invoices)).toBe(true);
    });

    it('should generate HAC invoices report for referral commission purchases', async () => {
      const report = await financeService.getHacInvoices({});
      expect(report).toBeDefined();
      expect(report.title).toContain('HAC');
      expect(Array.isArray(report.invoices)).toBe(true);
    });

    it('should generate comprehensive invoice summary report', async () => {
      const report = await financeService.getInvoiceSummary({});
      expect(report).toBeDefined();
      expect(report.summary.totalInvoices).toBeGreaterThanOrEqual(0);
      expect(typeof report.summary.totalNetBilled).toBe('number');
    });
  });

  describe('Settlement Reports', () => {
    it('should generate pending settlements report', async () => {
      const report = await financeService.getPendingSettlements({});
      expect(report).toBeDefined();
      expect(report.title).toContain('Settlements');
      expect(Array.isArray(report.settlements)).toBe(true);
    });

    it('should generate paid settlements report', async () => {
      const report = await financeService.getPaidSettlements({});
      expect(report).toBeDefined();
      expect(report.title).toContain('Settlements');
      expect(Array.isArray(report.settlements)).toBe(true);
    });

    it('should generate settlement history report', async () => {
      const report = await financeService.getSettlementHistory({});
      expect(report).toBeDefined();
      expect(report.title).toContain('Settlements');
      expect(Array.isArray(report.settlements)).toBe(true);
    });
  });

  describe('Finance Overview Dashboard', () => {
    it('should provide executive financial KPIs and recent activities', async () => {
      const overview = await financeService.getOverview();
      expect(overview).toBeDefined();
      expect(typeof overview.totalRevenue).toBe('number');
      expect(typeof overview.totalPartnerPayables).toBe('number');
      expect(Array.isArray(overview.recentTransactions)).toBe(true);
    });
  });

  describe('Multi-Format Report Export (CSV, XLSX, PDF)', () => {
    const testUser = {
      id: 'a0000000-0000-0000-0000-000000000001',
      name: 'Master Admin',
      email: 'master@hariomthalassic.com',
    };

    it('should export report in CSV format', async () => {
      const res = await financeService.exportReport(
        { reportType: 'revenue_daily', format: 'csv' },
        testUser,
      );
      expect(res).toBeDefined();
      expect(res.contentType).toContain('text/csv');
      expect(typeof res.data).toBe('string');
      expect(res.filename.endsWith('.csv')).toBe(true);
    });

    it('should export report in XLSX Excel format', async () => {
      const res = await financeService.exportReport(
        { reportType: 'invoices_summary', format: 'xlsx' },
        testUser,
      );
      expect(res).toBeDefined();
      expect(res.contentType).toContain('spreadsheetml');
      expect(Buffer.isBuffer(res.data)).toBe(true);
      expect(res.filename.endsWith('.xlsx')).toBe(true);
    });

    it('should export report in JSON data format', async () => {
      const res = await financeService.exportReport(
        { reportType: 'settlements_history', format: 'json' },
        testUser,
      );
      expect(res).toBeDefined();
      expect(res.data).toBeDefined();
      expect(res.filename.endsWith('.json')).toBe(true);
    });
  });

  describe('Section 7.8 Financial Audit Logs', () => {
    it('should log financial activity and make it searchable', async () => {
      const log = await financeService.logFinancialActivity(
        {
          action: 'PAYMENT_RECEIVED',
          module: 'Payments',
          entityId: 'TXN-TEST-999',
          details: 'Received ₹15,000 for BST course',
          previousValue: { status: 'Pending' },
          updatedValue: { status: 'Successful', amount: 15000 },
        },
        { id: 'master-1', name: 'Master Admin' },
      );

      expect(log).toBeDefined();
      expect(log.action).toBe('PAYMENT_RECEIVED');
      expect(log.entityId).toBe('TXN-TEST-999');

      const searchRes = await financeService.getAuditLogs({
        action: 'PAYMENT_RECEIVED',
        entityId: 'TXN-TEST-999',
      });

      expect(searchRes.total).toBeGreaterThanOrEqual(1);
      expect(searchRes.logs.some((l) => l.entity_id === 'TXN-TEST-999')).toBe(
        true,
      );
    });

    it('should throw BadRequestException on audit log update or delete (Section 7.8 Immutability)', () => {
      expect(() => financeService.updateAuditLog()).toThrow(
        BadRequestException,
      );
      expect(() => financeService.deleteAuditLog()).toThrow(
        BadRequestException,
      );
    });
  });
});
