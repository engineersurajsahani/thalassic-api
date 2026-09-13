import { SeafarerService } from './seafarer.service';

describe('Seafarer Portal - Chapter 5 PRD Requirements', () => {
  describe('Dashboard & Courses', () => {
    let service: SeafarerService;
    let mockSupabaseService: any;
    let mockInvoicesService: any;

    beforeEach(() => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: 'u1',
            name: 'Raj Kumar',
            email: 'raj@example.com',
            status: 'Active',
            phone: '+91 9988776655',
          },
        }),
      };

      const mockSupabaseClient = {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'User') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                      id: 'u1',
                      name: 'Raj Kumar',
                      email: 'raj@example.com',
                      status: 'Active',
                    },
                  }),
                }),
              }),
            };
          }
          if (table === 'Enrollment') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: [
                      {
                        id: 'e1',
                        status: 'Active',
                        progress: 40,
                        createdAt: new Date().toISOString(),
                        Course: {
                          id: 'c1',
                          name: 'Basic Safety Training',
                          code: 'BST',
                        },
                      },
                      {
                        id: 'e2',
                        status: 'Completed',
                        progress: 100,
                        createdAt: new Date().toISOString(),
                        Course: {
                          id: 'c2',
                          name: 'Medical Care',
                          code: 'MEDICARE',
                        },
                      },
                    ],
                  }),
                }),
              }),
            };
          }
          if (table === 'Document') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: [{ id: 'd1', type: 'PASSPORT', status: 'Approved' }],
                  }),
                }),
              }),
            };
          }
          if (table === 'SeaServiceRecord') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: [{ id: 's1', rank: 'Captain' }],
                  }),
                }),
              }),
            };
          }
          return mockQueryBuilder;
        }),
      };

      mockSupabaseService = {
        getClient: jest.fn().mockReturnValue(mockSupabaseClient),
      };

      mockInvoicesService = {
        generateInvoice: jest.fn(),
      };

      service = new SeafarerService(
        mockSupabaseService as any,
        mockInvoicesService as any,
      );
    });

    it('getDashboard should accurately summarize active and completed courses', async () => {
      const dashboard = await service.getDashboard('u1');

      expect(dashboard).toHaveProperty('courses');
      expect(dashboard.courses.ongoingCount).toBe(1);
      expect(dashboard.courses.completedCount).toBe(1);
      expect(dashboard).toHaveProperty('profileCompletion');
    });
  });
});
