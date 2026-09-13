import { SeafarerService } from './seafarer.service';

describe('Seafarer Portal - Chapter 5 PRD Requirements', () => {
  describe('Dashboard & Courses', () => {
    let service: SeafarerService;
    let mockUserRepo: any;

    beforeEach(() => {
      mockUserRepo = {
        findOne: jest.fn(),
      };
      const mockRepo = {
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((dto) => dto),
        save: jest
          .fn()
          .mockImplementation((dto) =>
            Promise.resolve({ id: 'saved-id', ...dto }),
          ),
      };
      const mockInvoicesService = {
        generateInvoice: jest.fn(),
      };
      const mockDataSource = {
        transaction: jest.fn(),
      };

      service = new SeafarerService(
        mockUserRepo as any,
        mockRepo as any,
        mockRepo as any,
        mockRepo as any,
        mockRepo as any,
        mockRepo as any,
        mockRepo as any,
        mockRepo as any,
        mockRepo as any,
        mockRepo as any,
        mockRepo as any,
        mockRepo as any,
        mockRepo as any,
        mockRepo as any,
        mockInvoicesService as any,
        mockDataSource as any,
      );
    });

    it('getDashboard should accurately summarize active and completed courses', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'u1',
        name: 'Raj Kumar',
        email: 'raj@example.com',
        status: 'Active',
        profile: { indosNum: '20N1234' },
        enrollments: [
          {
            id: 'e1',
            status: 'Active',
            courseInstitute: {
              course: { name: 'Basic Safety Training', code: 'BST' },
            },
          },
          {
            id: 'e2',
            status: 'Completed',
            courseInstitute: {
              course: { name: 'Medical Care', code: 'MEDICARE' },
            },
          },
        ],
        documents: [{ id: 'd1' }],
        seaServiceRecords: [{ id: 's1', durationDays: 120 }],
      });

      const dashboard = await service.getDashboard('u1');

      expect(dashboard.user.id).toBe('u1');
      expect(dashboard.stats.activeCourses).toBe(1);
      expect(dashboard.stats.completedCourses).toBe(1);
      expect(dashboard.stats.totalDocuments).toBe(1);
      expect(dashboard.stats.totalSeaDays).toBe(120);
    });
  });
});
