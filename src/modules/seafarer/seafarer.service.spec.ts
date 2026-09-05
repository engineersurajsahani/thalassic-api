import { getInstitutesForCourse, CONFIGURED_INSTITUTES, SeafarerService } from './seafarer.service';

describe('Seafarer Portal - Chapter 5 PRD Requirements', () => {
  describe('5.2 Course and Institute Information', () => {
    it('should return only institutes associated with the specific course', () => {
      // BST is associated with 5 campuses
      const bstInsts = getInstitutesForCourse('BST');
      expect(bstInsts.length).toBe(5);
      expect(bstInsts.map(i => i.id)).toContain('inst-mumbai');
      expect(bstInsts.map(i => i.id)).toContain('inst-chennai');

      // AFF (Advanced Fire Fighting) is associated only with Mumbai, Kolkata, Goa
      const affInsts = getInstitutesForCourse('AFF');
      expect(affInsts.length).toBe(3);
      expect(affInsts.map(i => i.id)).toEqual(['inst-mumbai', 'inst-kolkata', 'inst-goa']);

      // OCTCO (Tanker Ops) is associated only with Mumbai, Chennai, Kochi
      const octcoInsts = getInstitutesForCourse('OCTCO');
      expect(octcoInsts.length).toBe(3);
      expect(octcoInsts.map(i => i.id)).toEqual(['inst-mumbai', 'inst-chennai', 'inst-kochi']);
    });

    it('each institute should contain mandatory Name, IDT number, campus address, and schedule', () => {
      CONFIGURED_INSTITUTES.forEach(inst => {
        expect(inst.name).toBeDefined();
        expect(inst.idtNumber).toMatch(/^IDT-\d+/);
        expect(inst.address).toBeDefined();
        expect(inst.schedule).toBeDefined();
        expect(inst.phone).toBeDefined();
        expect(inst.email).toBeDefined();
      });
    });
  });

  describe('5.4 & 5.5 Seafarer Status — On Hold & Progress Separation', () => {
    let service: SeafarerService;
    let mockSupabase: any;
    let mockInvoicesService: any;

    beforeEach(() => {
      mockSupabase = {
        getClient: jest.fn(),
      };
      mockInvoicesService = {
        generateInvoice: jest.fn(),
      };
      service = new SeafarerService(mockSupabase as any, mockInvoicesService as any);
    });

    it('getDashboard should accurately separate ongoing, on hold, and completed courses', async () => {
      const mockDb = {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'User') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'u1', name: 'Raj Kumar', status: 'Active' } }),
            };
          }
          if (table === 'Enrollment') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockResolvedValue({
                data: [
                  {
                    id: 'e1',
                    status: 'Processing',
                    progress: 40,
                    startDate: '2026-01-01',
                    createdAt: '2026-01-01',
                    courseId: 'c1',
                    remarks: JSON.stringify({ instituteId: 'inst-mumbai', batchSchedule: 'Mon - Fri | 09:00 - 17:30 IST' }),
                    Course: { id: 'c1', name: 'Basic Safety Training', code: 'BST', duration: '12 Days' },
                  },
                  {
                    id: 'e2',
                    status: 'On Hold',
                    progress: 0,
                    startDate: '2026-01-02',
                    createdAt: '2026-01-02',
                    courseId: 'c2',
                    remarks: JSON.stringify({ instituteId: 'inst-chennai' }),
                    Course: { id: 'c2', name: 'Advanced Fire Fighting', code: 'AFF', duration: '5 Days' },
                  },
                  {
                    id: 'e3',
                    status: 'Completed',
                    progress: 100,
                    startDate: '2025-12-01',
                    createdAt: '2025-12-01',
                    courseId: 'c3',
                    Course: { id: 'c3', name: 'Medical Care', code: 'MEDICARE', duration: '5 Days' },
                  },
                ],
              }),
            };
          }
          if (table === 'SeafarerProfile') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: { indosNumber: '20N1234', dob: '1995-01-01' } }),
            };
          }
          if (table === 'Document') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockResolvedValue({ data: [] }),
            };
          }
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
          };
        }),
      };

      (mockSupabase.getClient as jest.Mock).mockReturnValue(mockDb);

      const dashboard = await service.getDashboard('u1');

      expect(dashboard.courses.ongoingCount).toBe(1);
      expect(dashboard.courses.onHoldCount).toBe(1);
      expect(dashboard.courses.completedCount).toBe(1);
      expect(dashboard.courses.active?.name).toBe('Basic Safety Training');
      expect(dashboard.courses.active?.trainingType).toBe('Physical / Offline Training');
      expect(dashboard.courses.onHold?.name).toBe('Advanced Fire Fighting');
      expect(dashboard.courses.onHold?.status).toBe('On Hold');
    });
  });
});
