import { Test, TestingModule } from '@nestjs/testing';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('FinanceController', () => {
  let controller: FinanceController;
  let service: FinanceService;

  const mockFinanceService = {
    getOverview: jest.fn().mockResolvedValue({ status: 'ok' }),
    getDailyRevenue: jest.fn().mockResolvedValue({ reportTitle: 'Daily' }),
    getMonthlyRevenue: jest.fn().mockResolvedValue({ reportTitle: 'Monthly' }),
    getAnnualRevenue: jest.fn().mockResolvedValue({ reportTitle: 'Annual' }),
    getConsolidatedRevenue: jest.fn().mockResolvedValue({ reportTitle: 'Revenue' }),
    getSuccessfulPayments: jest.fn().mockResolvedValue({ reportTitle: 'Successful' }),
    getFailedPayments: jest.fn().mockResolvedValue({ reportTitle: 'Failed' }),
    getPendingPayments: jest.fn().mockResolvedValue({ reportTitle: 'Pending' }),
    getConsolidatedPayments: jest.fn().mockResolvedValue({ reportTitle: 'Payments' }),
    getPendingCommissions: jest.fn().mockResolvedValue({ reportTitle: 'Pending' }),
    getPaidCommissions: jest.fn().mockResolvedValue({ reportTitle: 'Paid' }),
    getOutstandingCommissions: jest.fn().mockResolvedValue({ reportTitle: 'Outstanding' }),
    getConsolidatedCommissions: jest.fn().mockResolvedValue({ reportTitle: 'Commissions' }),
    getHocInvoices: jest.fn().mockResolvedValue({ reportTitle: 'HOC' }),
    getHacInvoices: jest.fn().mockResolvedValue({ reportTitle: 'HAC' }),
    getInvoiceSummary: jest.fn().mockResolvedValue({ reportTitle: 'Summary' }),
    getConsolidatedInvoices: jest.fn().mockResolvedValue({ reportTitle: 'Invoices' }),
    getPendingSettlements: jest.fn().mockResolvedValue({ reportTitle: 'Pending' }),
    getPaidSettlements: jest.fn().mockResolvedValue({ reportTitle: 'Paid' }),
    getSettlementHistory: jest.fn().mockResolvedValue({ reportTitle: 'History' }),
    getConsolidatedSettlements: jest.fn().mockResolvedValue({ reportTitle: 'Settlements' }),
    exportReport: jest.fn().mockResolvedValue({ filename: 'test.csv', contentType: 'text/csv', data: 'csv-data' }),
    getAuditLogs: jest.fn().mockResolvedValue({ total: 1, logs: [] }),
    getAuditLogById: jest.fn().mockResolvedValue({ id: '1' }),
    logFinancialActivity: jest.fn().mockResolvedValue({ id: '1' }),
    updateAuditLog: jest.fn(),
    deleteAuditLog: jest.fn(),
  };

  const mockSupabaseService = {
    getClient: jest.fn().mockReturnValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinanceController],
      providers: [
        {
          provide: FinanceService,
          useValue: mockFinanceService,
        },
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    controller = module.get<FinanceController>(FinanceController);
    service = module.get<FinanceService>(FinanceService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  it('should call getOverview', async () => {
    const result = await controller.getOverview();
    expect(result).toEqual({ status: 'ok' });
    expect(service.getOverview).toHaveBeenCalled();
  });

  it('should call getDailyRevenue', async () => {
    const result = await controller.getDailyRevenue({});
    expect(result).toEqual({ reportTitle: 'Daily' });
    expect(service.getDailyRevenue).toHaveBeenCalledWith({});
  });
});
