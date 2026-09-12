import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Company,
  CompanyAdmin,
  CompanySeafarer,
  User,
  UserRole,
  UserStatus,
  Course,
  Institute,
  CourseInstitute,
  Enrollment,
  EnrollmentStatus,
  Invoice,
  InvoiceType,
  PaymentMethod,
  AuditLog,
} from '../../entities';
import { InvoicesService } from '../invoices/invoices.service';

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(CompanyAdmin)
    private readonly companyAdminRepo: Repository<CompanyAdmin>,
    @InjectRepository(CompanySeafarer)
    private readonly companySeafarerRepo: Repository<CompanySeafarer>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,
    @InjectRepository(Institute)
    private readonly instituteRepo: Repository<Institute>,
    @InjectRepository(CourseInstitute)
    private readonly courseInstituteRepo: Repository<CourseInstitute>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly invoicesService: InvoicesService,
    private readonly dataSource: DataSource,
  ) {}

  async getCompanyForUser(userId: string): Promise<Company> {
    const adminLink = await this.companyAdminRepo.findOne({
      where: { userId },
      relations: {
        company: true,
      },
    });

    if (adminLink?.company) {
      return adminLink.company;
    }

    const fallback = await this.companyRepo.findOne({
      where: {},
      order: { createdAt: 'ASC' },
    });

    if (fallback) return fallback;

    const newCompany = this.companyRepo.create({
      name: 'Global Shipping Fleet Ltd',
      rpslNumber: 'RPSL-MUM-1029',
      email: 'corporate@shippingfleet.com',
      phone: '+91 22 40001000',
      status: 'Active',
    });
    return await this.companyRepo.save(newCompany);
  }

  // --- 1. Dashboard Overview ---
  async getDashboard(userId: string) {
    const company = await this.getCompanyForUser(userId);

    const crew = await this.companySeafarerRepo.find({
      where: { companyId: company.id },
      relations: {
        user: {
          profile: true,
          enrollments: {
            courseInstitute: {
              course: true,
            },
          },
        },
      },
    });

    const invoices = await this.invoicesService.getInvoices({
      id: userId,
      role: 'COMPANY_ADMIN',
    });

    const totalCrew = crew.length;
    const activeCrew = crew.filter((c) => c.status === 'Employed').length;

    return {
      company: {
        id: company.id,
        name: company.name,
        rpslNumber: company.rpslNumber,
        email: company.email,
        status: company.status,
      },
      stats: {
        totalCrew,
        activeCrew,
        totalInvoices: invoices.length,
      },
      recentCrew: crew.slice(0, 10).map((c) => ({
        id: c.id,
        userId: c.userId,
        name: c.user?.name,
        email: c.user?.email,
        designationRank: c.designationRank,
        status: c.status,
        joinedAt: c.joinedAt,
      })),
    };
  }

  // --- 2. Company Profile ---
  async getProfile(userId: string) {
    return await this.getCompanyForUser(userId);
  }

  async updateProfile(userId: string, data: any) {
    const company = await this.getCompanyForUser(userId);

    if (data.name) company.name = data.name;
    if (data.address) company.address = data.address;
    if (data.city) company.city = data.city;
    if (data.state) company.state = data.state;
    if (data.phone) company.phone = data.phone;
    if (data.website) company.website = data.website;

    return await this.companyRepo.save(company);
  }

  // --- 3. Crew Roster ---
  async getCrew(userId: string) {
    const company = await this.getCompanyForUser(userId);
    const crew = await this.companySeafarerRepo.find({
      where: { companyId: company.id },
      relations: {
        user: {
          profile: true,
          documents: true,
          enrollments: true,
        },
      },
      order: { createdAt: 'DESC' },
    });

    return crew.map((c) => ({
      id: c.id,
      userId: c.userId,
      name: c.user?.name,
      email: c.user?.email,
      phone: c.user?.phone,
      employeeId: c.employeeId,
      designationRank: c.designationRank,
      status: c.status,
      joinedAt: c.joinedAt,
      indosNumber: c.user?.profile?.indosNum || 'N/A',
      cdcNumber: c.user?.profile?.cdcNum || 'N/A',
      passportNumber: c.user?.profile?.passportNum || 'N/A',
      documentsCount: (c.user?.documents || []).length,
      enrollmentsCount: (c.user?.enrollments || []).length,
    }));
  }

  async addCrewMember(userId: string, data: any) {
    const company = await this.getCompanyForUser(userId);
    const cleanEmail = (data.email || '').trim().toLowerCase();

    let user = await this.userRepo.findOne({ where: { email: cleanEmail } });
    if (!user) {
      user = this.userRepo.create({
        email: cleanEmail,
        name: data.name || cleanEmail.split('@')[0],
        phone: data.phone || null,
        role: UserRole.SEAFARER,
        status: UserStatus.ACTIVE,
      });
      user = await this.userRepo.save(user);
    }

    const seafarerLink = this.companySeafarerRepo.create({
      companyId: company.id,
      userId: user.id,
      employeeId: data.employeeId || data.employee_id || null,
      designationRank:
        data.designationRank || data.designation_rank || data.rank || 'Officer',
      status: 'Employed',
      joinedAt:
        data.joinedAt ||
        data.joined_at ||
        new Date().toISOString().split('T')[0],
    });

    const saved = await this.companySeafarerRepo.save(seafarerLink);

    await this.auditLogRepo.save({
      actorUserId: userId,
      action: 'ADD_COMPANY_CREW_MEMBER',
      module: 'COMPANY',
      entityTable: 'company_seafarers',
      entityId: saved.id,
      companyId: company.id,
      details: `Added ${user.name} to corporate fleet roster (${saved.designationRank})`,
    });

    return saved;
  }

  // --- 4. Bulk Course Sponsorship ---
  async sponsorCourse(
    userId: string,
    data: {
      seafarerUserIds: string[];
      courseId: string;
      instituteId: string;
      paymentMethod?: PaymentMethod;
    },
  ) {
    const company = await this.getCompanyForUser(userId);
    const { seafarerUserIds, courseId, instituteId, paymentMethod } = data;

    const course = await this.courseRepo.findOne({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');

    const institute = await this.instituteRepo.findOne({
      where: { id: instituteId },
    });
    if (!institute) throw new NotFoundException('Institute not found');

    let courseInstitute = await this.courseInstituteRepo.findOne({
      where: { courseId, instituteId },
    });

    if (!courseInstitute) {
      courseInstitute = this.courseInstituteRepo.create({
        courseId,
        instituteId,
        batchFrequency: 'Weekly on Mondays',
        capacity: 24,
      });
      await this.courseInstituteRepo.save(courseInstitute);
    }

    const feePerSeat = Number(course.standardFee);
    const totalAmount = feePerSeat * seafarerUserIds.length;

    return await this.dataSource.transaction(async (manager) => {
      const createdEnrollments: Enrollment[] = [];

      for (const sUserId of seafarerUserIds) {
        const enrollment = manager.create(Enrollment, {
          userId: sUserId,
          courseInstituteId: courseInstitute.id,
          status: EnrollmentStatus.ACTIVE,
          progressPercent: 0,
        });
        const savedE = await manager.save(enrollment);
        createdEnrollments.push(savedE);
      }

      // Generate B2B Company Invoice
      const invoice = await this.invoicesService.generateInvoice({
        companyId: company.id,
        invoiceType: InvoiceType.COMPANY,
        totalAmount,
        netPayable: totalAmount,
        paymentMethod: paymentMethod || PaymentMethod.CORPORATE_CREDIT,
        actorUserId: userId,
      });

      await this.auditLogRepo.save({
        actorUserId: userId,
        action: 'SPONSOR_CREW_TRAINING',
        module: 'COMPANY',
        entityTable: 'invoices',
        entityId: invoice.id,
        companyId: company.id,
        details: `Company ${company.name} sponsored ${seafarerUserIds.length} seafarers for ${course.code} (Invoice: ${invoice.invoiceNumber})`,
      });

      return {
        enrollments: createdEnrollments,
        invoice,
      };
    });
  }
}
