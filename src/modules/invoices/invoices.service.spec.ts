import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesService } from './invoices.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('InvoicesService', () => {
  let service: InvoicesService;

  const mockSupabase = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    single: jest.fn().mockResolvedValue({ data: { id: 'inv-1', invoiceNumber: 'HAC-2026-0001' }, error: null }),
  };

  const mockSupabaseService = {
    getClient: jest.fn().mockReturnValue(mockSupabase),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should reject invoice deletion (immutability rule)', async () => {
    await expect(service.deleteInvoice()).rejects.toThrow();
  });

  it('should reject invoice update (immutability rule)', async () => {
    await expect(service.updateInvoice()).rejects.toThrow();
  });
});
