import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesService } from './invoices.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  Invoice,
  InvoiceCounter,
  Payment,
  AuditLog,
  PlatformSettings,
  User,
  Partner,
  Enrollment,
} from '../../entities';

describe('InvoicesService', () => {
  let service: InvoicesService;

  const mockRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest
      .fn()
      .mockImplementation((dto) => Promise.resolve({ id: 'saved-id', ...dto })),
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: getRepositoryToken(Invoice), useValue: mockRepo },
        { provide: getRepositoryToken(InvoiceCounter), useValue: mockRepo },
        { provide: getRepositoryToken(Payment), useValue: mockRepo },
        { provide: getRepositoryToken(AuditLog), useValue: mockRepo },
        { provide: getRepositoryToken(PlatformSettings), useValue: mockRepo },
        { provide: getRepositoryToken(User), useValue: mockRepo },
        { provide: getRepositoryToken(Partner), useValue: mockRepo },
        { provide: getRepositoryToken(Enrollment), useValue: mockRepo },
        { provide: DataSource, useValue: mockDataSource },
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
