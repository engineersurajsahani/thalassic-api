import { Test, TestingModule } from '@nestjs/testing';
import { MasterService } from './master.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  User,
  Course,
  Institute,
  CourseInstitute,
  Enrollment,
  Partner,
  PartnerCoursePricing,
  PartnerPricingProposal,
  PartnerPayable,
  Settlement,
  Document,
  AuditLog,
  PlatformSettings,
  SupportTicket,
  Notification,
} from '../../entities';

describe('MasterService', () => {
  let service: MasterService;

  const mockRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest
      .fn()
      .mockImplementation((dto) => Promise.resolve({ id: 'saved-id', ...dto })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MasterService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
        { provide: getRepositoryToken(Course), useValue: mockRepo },
        { provide: getRepositoryToken(Institute), useValue: mockRepo },
        { provide: getRepositoryToken(CourseInstitute), useValue: mockRepo },
        { provide: getRepositoryToken(Enrollment), useValue: mockRepo },
        { provide: getRepositoryToken(Partner), useValue: mockRepo },
        {
          provide: getRepositoryToken(PartnerCoursePricing),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(PartnerPricingProposal),
          useValue: mockRepo,
        },
        { provide: getRepositoryToken(PartnerPayable), useValue: mockRepo },
        { provide: getRepositoryToken(Settlement), useValue: mockRepo },
        { provide: getRepositoryToken(Document), useValue: mockRepo },
        { provide: getRepositoryToken(AuditLog), useValue: mockRepo },
        { provide: getRepositoryToken(PlatformSettings), useValue: mockRepo },
        { provide: getRepositoryToken(SupportTicket), useValue: mockRepo },
        { provide: getRepositoryToken(Notification), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<MasterService>(MasterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return courses list', async () => {
    mockRepo.find.mockResolvedValueOnce([
      { id: 'course-1', name: 'Safety Training', code: 'BST' },
    ]);

    const courses = await service.getCourses();
    expect(Array.isArray(courses)).toBe(true);
    expect(courses.length).toBe(1);
    expect(courses[0].code).toBe('BST');
  });

  it('should return seafarers list', async () => {
    mockRepo.find.mockResolvedValueOnce([
      { id: 'u1', name: 'John Doe', role: 'SEAFARER' },
    ]);

    const users = await service.getSeafarers();
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBe(1);
  });
});
