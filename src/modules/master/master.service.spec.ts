import { Test, TestingModule } from '@nestjs/testing';
import { MasterService } from './master.service';
import { SupabaseService } from '../supabase/supabase.service';
import { InvoicesService } from '../invoices/invoices.service';
import { AgentAdminService } from '../agent-admin/agent-admin.service';

describe('MasterService', () => {
  let service: MasterService;

  let queryBuilder: any;
  let mockSupabase: any;

  beforeEach(async () => {
    queryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
      then: jest.fn((resolve) => resolve({ data: [], error: null })),
    };

    mockSupabase = {
      from: jest.fn().mockReturnValue(queryBuilder),
    };

    const mockSupabaseService = {
      getClient: jest.fn().mockReturnValue(mockSupabase),
    };

    const mockInvoicesService = {
      getInvoices: jest.fn().mockResolvedValue([]),
      getInvoiceById: jest.fn().mockResolvedValue({ id: 'inv-1' }),
    };

    const mockAgentAdminService = {
      getAgents: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MasterService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: InvoicesService, useValue: mockInvoicesService },
        { provide: AgentAdminService, useValue: mockAgentAdminService },
      ],
    }).compile();

    service = module.get<MasterService>(MasterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return courses list', async () => {
    queryBuilder.order.mockResolvedValueOnce({
      data: [{ id: 'course-1', name: 'Safety Training', code: 'BST' }],
      error: null,
    });

    const courses = await service.getCourses();
    expect(Array.isArray(courses)).toBe(true);
    expect(courses.length).toBe(1);
    expect(courses[0].code).toBe('BST');
  });

  it('should return users list with role filter', async () => {
    queryBuilder.then = jest.fn((resolve) =>
      resolve({
        data: [{ id: 'u1', name: 'John Doe', role: 'SEAFARER' }],
        error: null,
      }),
    );

    const users = await service.getUsers('seafarer');
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBe(1);
  });
});

