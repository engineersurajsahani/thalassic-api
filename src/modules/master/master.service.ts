import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  User,
  UserRole,
  UserStatus,
  Course,
  CourseStatus,
  Institute,
  CourseInstitute,
  Enrollment,
  EnrollmentStatus,
  Partner,
  PartnerCoursePricing,
  PartnerPricingProposal,
  PricingProposalStatus,
  PartnerPayable,
  Settlement,
  Document,
  AuditLog,
  PlatformSettings,
  SupportTicket,
  Notification,
} from '../../entities';

@Injectable()
export class MasterService {
  constructor(
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
    @InjectRepository(Partner)
    private readonly partnerRepo: Repository<Partner>,
    @InjectRepository(PartnerCoursePricing)
    private readonly pricingRepo: Repository<PartnerCoursePricing>,
    @InjectRepository(PartnerPricingProposal)
    private readonly proposalRepo: Repository<PartnerPricingProposal>,
    @InjectRepository(PartnerPayable)
    private readonly payableRepo: Repository<PartnerPayable>,
    @InjectRepository(Settlement)
    private readonly settlementRepo: Repository<Settlement>,
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(PlatformSettings)
    private readonly settingsRepo: Repository<PlatformSettings>,
    @InjectRepository(SupportTicket)
    private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  // --- 1. Master Executive Dashboard Stats ---
  async getDashboardStats() {
    const totalUsers = await this.userRepo.count();
    const totalSeafarers = await this.userRepo.count({
      where: { role: UserRole.SEAFARER },
    });
    const totalPartners = await this.partnerRepo.count();
    const totalCourses = await this.courseRepo.count();
    const totalInstitutes = await this.instituteRepo.count();
    const totalEnrollments = await this.enrollmentRepo.count();
    const pendingProposalsCount = await this.proposalRepo.count({
      where: { status: PricingProposalStatus.PENDING_MASTER_APPROVAL },
    });

    const recentEnrollments = await this.enrollmentRepo.find({
      relations: {
        user: true,
        courseInstitute: {
          course: true,
          institute: true,
        },
        partner: true,
      },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return {
      stats: {
        totalUsers,
        totalSeafarers,
        totalPartners,
        totalCourses,
        totalInstitutes,
        totalEnrollments,
        pendingProposalsCount,
      },
      recentEnrollments: recentEnrollments.map((e) => ({
        id: e.id,
        candidateName: e.user?.name || 'Seafarer',
        candidateEmail: e.user?.email || '',
        courseName: e.courseInstitute?.course?.name || 'Course',
        instituteName: e.courseInstitute?.institute?.name || 'Campus',
        partnerName: e.partner?.agencyName || 'Direct',
        status: e.status,
        progress: e.progressPercent,
        createdAt: e.createdAt,
      })),
    };
  }

  // --- 2. Course Catalog Management ---
  async getCourses() {
    return await this.courseRepo.find({
      relations: {
        instituteOfferings: {
          institute: true,
        },
      },
      order: { code: 'ASC' },
    });
  }

  async getCourseById(id: string) {
    const course = await this.courseRepo.findOne({
      where: { id },
      relations: {
        instituteOfferings: {
          institute: true,
        },
      },
    });
    if (!course) throw new NotFoundException(`Course ${id} not found.`);
    return course;
  }

  async createCourse(data: any, actorUserId?: string) {
    const course = this.courseRepo.create({
      code: data.code,
      name: data.name,
      category: data.category,
      duration: data.duration,
      standardFee: Number(data.standardFee || data.fees || data.standard_fee),
      description: data.description || null,
      status: (data.status as CourseStatus) || CourseStatus.ACTIVE,
    });

    const saved = await this.courseRepo.save(course);

    if (data.instituteIds && Array.isArray(data.instituteIds)) {
      for (const instId of data.instituteIds) {
        const mapping = this.courseInstituteRepo.create({
          courseId: saved.id,
          instituteId: instId,
          batchFrequency: data.batchFrequency || 'Weekly',
          capacity: data.capacity || 24,
        });
        await this.courseInstituteRepo.save(mapping);
      }
    }

    await this.auditLogRepo.save({
      actorUserId: actorUserId || null,
      action: 'CREATE_COURSE',
      module: 'COURSES',
      entityTable: 'courses',
      entityId: saved.id,
      details: `Created course ${saved.code}: ${saved.name} (Fee: ₹${saved.standardFee})`,
    });

    return saved;
  }

  async updateCourse(id: string, data: any, actorUserId?: string) {
    const course = await this.courseRepo.findOne({ where: { id } });
    if (!course) throw new NotFoundException(`Course ${id} not found.`);

    if (data.name) course.name = data.name;
    if (data.category) course.category = data.category;
    if (data.duration) course.duration = data.duration;
    if (data.standardFee || data.fees || data.standard_fee) {
      course.standardFee = Number(
        data.standardFee || data.fees || data.standard_fee,
      );
    }
    if (data.description !== undefined) course.description = data.description;
    if (data.status) course.status = data.status;

    const saved = await this.courseRepo.save(course);

    await this.auditLogRepo.save({
      actorUserId: actorUserId || null,
      action: 'UPDATE_COURSE',
      module: 'COURSES',
      entityTable: 'courses',
      entityId: saved.id,
      details: `Updated course ${saved.code}`,
    });

    return saved;
  }

  async deleteCourse(id: string, actorUserId?: string) {
    const course = await this.courseRepo.findOne({ where: { id } });
    if (!course) throw new NotFoundException(`Course ${id} not found.`);

    await this.courseRepo.remove(course);

    await this.auditLogRepo.save({
      actorUserId: actorUserId || null,
      action: 'DELETE_COURSE',
      module: 'COURSES',
      entityTable: 'courses',
      entityId: id,
      details: `Deleted course ${course.code}`,
    });

    return { message: `Course ${id} deleted successfully.` };
  }

  // --- 3. Institutes Management ---
  async getInstitutes() {
    return await this.instituteRepo.find({
      relations: {
        courseOfferings: {
          course: true,
        },
      },
      order: { name: 'ASC' },
    });
  }

  async createInstitute(data: any, actorUserId?: string) {
    const institute = this.instituteRepo.create({
      name: data.name,
      code: data.code,
      city: data.city,
      state: data.state,
      address: data.address,
      accreditationId:
        data.accreditationId || data.accreditation_id || 'DGS-CAMPUS',
      contactEmail: data.contactEmail || data.contact_email || null,
      contactPhone: data.contactPhone || data.contact_phone || null,
      isActive: data.isActive ?? true,
    });

    const saved = await this.instituteRepo.save(institute);

    await this.auditLogRepo.save({
      actorUserId: actorUserId || null,
      action: 'CREATE_INSTITUTE',
      module: 'INSTITUTES',
      entityTable: 'institutes',
      entityId: saved.id,
      details: `Created institute campus ${saved.name} (${saved.city})`,
    });

    return saved;
  }

  // --- 4. Seafarer Profiles & Audit ---
  async getSeafarers() {
    const seafarers = await this.userRepo.find({
      where: { role: UserRole.SEAFARER },
      relations: {
        profile: true,
        documents: true,
        enrollments: {
          courseInstitute: {
            course: true,
          },
        },
      },
      order: { createdAt: 'DESC' },
    });

    return seafarers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      status: u.status,
      indosNumber: u.profile?.indosNum || 'N/A',
      cdcNumber: u.profile?.cdcNum || 'N/A',
      passportNumber: u.profile?.passportNum || 'N/A',
      documentsCount: (u.documents || []).length,
      enrollmentsCount: (u.enrollments || []).length,
      createdAt: u.createdAt,
    }));
  }

  async auditSeafarer(
    userId: string,
    status: UserStatus,
    notes?: string,
    actorUserId?: string,
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found.`);

    user.status = status;
    const saved = await this.userRepo.save(user);

    await this.auditLogRepo.save({
      actorUserId: actorUserId || null,
      action: 'AUDIT_SEAFARER_STATUS',
      module: 'SEAFARERS',
      entityTable: 'users',
      entityId: user.id,
      details: `Audited seafarer ${user.email} -> Status: ${status}. Notes: ${notes || 'None'}`,
    });

    return saved;
  }

  async verifyDocument(
    docId: string,
    status: string,
    remarks?: string,
    reviewerUserId?: string,
  ) {
    const doc = await this.documentRepo.findOne({ where: { id: docId } });
    if (!doc) throw new NotFoundException(`Document ${docId} not found.`);

    doc.status = status;
    doc.remarks = remarks || null;
    doc.verifiedBy = reviewerUserId || null;
    doc.verifiedAt = new Date();

    const saved = await this.documentRepo.save(doc);

    await this.auditLogRepo.save({
      actorUserId: reviewerUserId || null,
      action: 'VERIFY_DOCUMENT',
      module: 'DOCUMENTS',
      entityTable: 'documents',
      entityId: doc.id,
      details: `Document ${doc.name} (${doc.type}) marked as ${status}`,
    });

    return saved;
  }

  // --- 5. Platform Settings ---
  async getSettings() {
    let settings = await this.settingsRepo.findOne({ where: {} });
    if (!settings) {
      settings = this.settingsRepo.create({
        systemEmail: 'support@hariomthalassic.com',
        contactPhone: '+91 22 12345678',
        paymentGateway: 'razorpay_production_mode',
        dgsAccreditationId: 'DGS-MTI-10294',
        gstin: '27AABCH1234F1Z5',
        termsAndConditions: 'Standard DGS approved terms.',
      });
      await this.settingsRepo.save(settings);
    }
    return settings;
  }

  async updateSettings(data: any, actorUserId?: string) {
    const settings = await this.getSettings();
    if (data.systemEmail || data.system_email)
      settings.systemEmail = data.systemEmail || data.system_email;
    if (data.contactPhone || data.contact_phone)
      settings.contactPhone = data.contactPhone || data.contact_phone;
    if (data.paymentGateway || data.payment_gateway)
      settings.paymentGateway = data.paymentGateway || data.payment_gateway;
    if (data.dgsAccreditationId || data.dgs_accreditation_id)
      settings.dgsAccreditationId =
        data.dgsAccreditationId || data.dgs_accreditation_id;
    if (data.gstin) settings.gstin = data.gstin;
    if (data.termsAndConditions || data.terms_and_conditions)
      settings.termsAndConditions =
        data.termsAndConditions || data.terms_and_conditions;

    const saved = await this.settingsRepo.save(settings);

    await this.auditLogRepo.save({
      actorUserId: actorUserId || null,
      action: 'UPDATE_PLATFORM_SETTINGS',
      module: 'SETTINGS',
      entityTable: 'platform_settings',
      entityId: saved.id,
      details:
        'Updated global platform accreditation and gateway configurations.',
    });

    return saved;
  }
}
