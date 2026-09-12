import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  User,
  SeafarerProfile,
  SeaServiceRecord,
  Document,
  Enrollment,
  EnrollmentStatus,
  Course,
  CourseStatus,
  Institute,
  CourseInstitute,
  Partner,
  PartnerCoursePricing,
  PartnerPayable,
  PayableStatus,
  Invoice,
  InvoiceType,
  Payment,
  PaymentMethod,
  SupportTicket,
  SupportTicketReply,
  Notification,
  AuditLog,
} from '../../entities';
import { InvoicesService } from '../invoices/invoices.service';

@Injectable()
export class SeafarerService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(SeafarerProfile)
    private readonly profileRepo: Repository<SeafarerProfile>,
    @InjectRepository(SeaServiceRecord)
    private readonly seaServiceRepo: Repository<SeaServiceRecord>,
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,
    @InjectRepository(Institute)
    private readonly instituteRepo: Repository<Institute>,
    @InjectRepository(CourseInstitute)
    private readonly courseInstituteRepo: Repository<CourseInstitute>,
    @InjectRepository(Partner)
    private readonly partnerRepo: Repository<Partner>,
    @InjectRepository(PartnerCoursePricing)
    private readonly pricingRepo: Repository<PartnerCoursePricing>,
    @InjectRepository(PartnerPayable)
    private readonly payableRepo: Repository<PartnerPayable>,
    @InjectRepository(SupportTicket)
    private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(SupportTicketReply)
    private readonly replyRepo: Repository<SupportTicketReply>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly invoicesService: InvoicesService,
    private readonly dataSource: DataSource,
  ) {}

  // --- 1. Dashboard Overview ---
  async getDashboard(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: {
        profile: true,
        enrollments: {
          courseInstitute: {
            course: true,
            institute: true,
          },
        },
        documents: true,
        seaServiceRecords: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const activeEnrollments = (user.enrollments || []).filter(
      (e) =>
        e.status === EnrollmentStatus.ACTIVE ||
        e.status === EnrollmentStatus.PROCESSING,
    );

    const completedCourses = (user.enrollments || []).filter(
      (e) => e.status === EnrollmentStatus.COMPLETED,
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status,
      },
      profile: user.profile || null,
      stats: {
        activeCourses: activeEnrollments.length,
        completedCourses: completedCourses.length,
        totalDocuments: (user.documents || []).length,
        totalSeaDays: (user.seaServiceRecords || []).reduce(
          (s, r) => s + (r.durationDays || 0),
          0,
        ),
      },
      recentEnrollments: user.enrollments || [],
    };
  }

  // --- 2. Profile Management ---
  async getProfile(userId: string) {
    let profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) {
      profile = this.profileRepo.create({ userId, indosStatus: 'Pending' });
      await this.profileRepo.save(profile);
    }
    const user = await this.userRepo.findOne({ where: { id: userId } });
    return {
      ...profile,
      name: user?.name,
      email: user?.email,
      phone: user?.phone,
    };
  }

  async updateProfile(userId: string, data: any) {
    let profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) {
      profile = this.profileRepo.create({ userId });
    }

    if (data.dob) profile.dob = data.dob;
    if (data.birthPlace || data.birth_place)
      profile.birthPlace = data.birthPlace || data.birth_place;
    if (data.fatherName || data.father_name)
      profile.fatherName = data.fatherName || data.father_name;
    if (data.passportNum || data.passport_num)
      profile.passportNum = data.passportNum || data.passport_num;
    if (data.passportIssue || data.passport_issue)
      profile.passportIssue = data.passportIssue || data.passport_issue;
    if (data.passportExpiry || data.passport_expiry)
      profile.passportExpiry = data.passportExpiry || data.passport_expiry;
    if (data.passportPlace || data.passport_place)
      profile.passportPlace = data.passportPlace || data.passport_place;
    if (data.indosNum || data.indos_num)
      profile.indosNum = data.indosNum || data.indos_num;
    if (data.indosIssue || data.indos_issue)
      profile.indosIssue = data.indosIssue || data.indos_issue;
    if (data.cdcNum || data.cdc_num)
      profile.cdcNum = data.cdcNum || data.cdc_num;
    if (data.cdcIssue || data.cdc_issue)
      profile.cdcIssue = data.cdcIssue || data.cdc_issue;
    if (data.cdcExpiry || data.cdc_expiry)
      profile.cdcExpiry = data.cdcExpiry || data.cdc_expiry;
    if (data.cdcPlace || data.cdc_place)
      profile.cdcPlace = data.cdcPlace || data.cdc_place;
    if (data.education) profile.education = data.education;

    const saved = await this.profileRepo.save(profile);

    if (data.name || data.phone) {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (user) {
        if (data.name) user.name = data.name;
        if (data.phone) user.phone = data.phone;
        await this.userRepo.save(user);
      }
    }

    await this.auditLogRepo.save({
      actorUserId: userId,
      action: 'UPDATE_SEAFARER_PROFILE',
      module: 'SEAFARER',
      entityTable: 'seafarer_profiles',
      entityId: profile.id,
      details: `Updated seafarer maritime credentials (INDOS: ${profile.indosNum}, CDC: ${profile.cdcNum})`,
    });

    return saved;
  }

  // --- 3. Sea Service Sailing History ---
  async getSeaService(userId: string) {
    return await this.seaServiceRepo.find({
      where: { userId },
      order: { signOnDate: 'DESC' },
    });
  }

  async addSeaService(userId: string, data: any) {
    const signOn = new Date(data.signOnDate || data.sign_on_date);
    const signOff =
      data.signOffDate || data.sign_off_date
        ? new Date(data.signOffDate || data.sign_off_date)
        : null;
    let durationDays = null;
    if (signOff) {
      durationDays = Math.ceil(
        (signOff.getTime() - signOn.getTime()) / (1000 * 60 * 60 * 24),
      );
    }

    const record = this.seaServiceRepo.create({
      userId,
      rpslCompany: data.rpslCompany || data.rpsl_company || 'Fleet RPSL Agency',
      vesselName: data.vesselName || data.vessel_name,
      vesselType: data.vesselType || data.vessel_type || 'Bulk Carrier',
      imoNumber: data.imoNumber || data.imo_number || null,
      rank: data.rank,
      signOnDate: data.signOnDate || data.sign_on_date,
      signOffDate: data.signOffDate || data.sign_off_date || null,
      durationDays,
    });

    const saved = await this.seaServiceRepo.save(record);

    await this.auditLogRepo.save({
      actorUserId: userId,
      action: 'ADD_SEA_SERVICE_RECORD',
      module: 'SEAFARER',
      entityTable: 'sea_service_records',
      entityId: saved.id,
      details: `Logged sea service on ${saved.vesselName} as ${saved.rank}`,
    });

    return saved;
  }

  // --- 4. Documents & Certificate KYC ---
  async getDocuments(userId: string) {
    return await this.documentRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async uploadDocument(userId: string, data: any) {
    const doc = this.documentRepo.create({
      userId,
      type: data.type || 'STCW Certificate',
      name: data.name || 'Maritime Document',
      filePath: data.filePath || data.file_path || '/documents/sample.pdf',
      fileSize: data.fileSize || data.file_size || 1024,
      mimeType: data.mimeType || data.mime_type || 'application/pdf',
      status: 'Pending',
      documentNumber: data.documentNumber || data.document_number || null,
      expiryDate: data.expiryDate || data.expiry_date || null,
    });

    const saved = await this.documentRepo.save(doc);

    await this.auditLogRepo.save({
      actorUserId: userId,
      action: 'UPLOAD_DOCUMENT',
      module: 'DOCUMENTS',
      entityTable: 'documents',
      entityId: saved.id,
      details: `Uploaded ${saved.type} document: ${saved.name}`,
    });

    return saved;
  }

  // --- 5. Course Catalog & Campus Batches ---
  async getAvailableCourses() {
    return await this.courseRepo.find({
      where: { status: CourseStatus.ACTIVE },
      relations: {
        instituteOfferings: {
          institute: true,
        },
      },
      order: { code: 'ASC' },
    });
  }

  // --- 6. Course Enrollment & Booking ---
  async enrollCourse(
    userId: string,
    data: {
      courseId: string;
      instituteId: string;
      partnerId?: string;
      partnerReferralId?: string;
      paymentMethod?: PaymentMethod;
      gatewayTransactionId?: string;
    },
  ) {
    const {
      courseId,
      instituteId,
      partnerId,
      partnerReferralId,
      paymentMethod,
      gatewayTransactionId,
    } = data;

    const course = await this.courseRepo.findOne({ where: { id: courseId } });
    if (!course) throw new NotFoundException(`Course ${courseId} not found.`);

    const institute = await this.instituteRepo.findOne({
      where: { id: instituteId },
    });
    if (!institute)
      throw new NotFoundException(`Institute campus ${instituteId} not found.`);

    let courseInstitute = await this.courseInstituteRepo.findOne({
      where: { courseId, instituteId },
    });

    if (!courseInstitute) {
      courseInstitute = this.courseInstituteRepo.create({
        courseId,
        instituteId,
        batchFrequency: 'Weekly on Mondays',
        capacity: 24,
        isActive: true,
      });
      await this.courseInstituteRepo.save(courseInstitute);
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const totalFee = Number(course.standardFee);

    return await this.dataSource.transaction(async (manager) => {
      const enrollment = manager.create(Enrollment, {
        userId,
        courseInstituteId: courseInstitute.id,
        partnerId: partnerId || null,
        partnerReferralId: partnerReferralId || null,
        status: EnrollmentStatus.ACTIVE,
        progressPercent: 0,
        batchStartDate: new Date().toISOString().split('T')[0],
      });

      const savedEnrollment = await manager.save(enrollment);

      const invoiceType = partnerId ? InvoiceType.HAC : InvoiceType.HOC;
      const invoice = await this.invoicesService.generateInvoice({
        userId,
        partnerId: partnerId || undefined,
        enrollmentId: savedEnrollment.id,
        invoiceType,
        totalAmount: totalFee,
        taxAmount: 0,
        discountAmount: 0,
        netPayable: totalFee,
        paymentMethod: paymentMethod || PaymentMethod.RAZORPAY,
        gatewayTransactionId: gatewayTransactionId || `TXN-${Date.now()}`,
        actorUserId: userId,
      });

      if (partnerId) {
        const approvedPricing = await this.pricingRepo.findOne({
          where: { partnerId, courseId },
        });

        const approvedPayableAmount = approvedPricing
          ? Number(approvedPricing.activePayableAmount)
          : totalFee;

        const payable = manager.create(PartnerPayable, {
          partnerId,
          enrollmentId: savedEnrollment.id,
          invoiceId: invoice.id,
          courseId,
          seafarerUserId: userId,
          approvedPayableAmount,
          status: PayableStatus.APPROVED,
        });

        await manager.save(payable);
      }

      await this.auditLogRepo.save({
        actorUserId: userId,
        action: 'COURSE_ENROLLMENT_COMPLETED',
        module: 'ENROLLMENTS',
        entityTable: 'enrollments',
        entityId: savedEnrollment.id,
        partnerId: partnerId || null,
        details: `Seafarer ${user.name} enrolled in ${course.code} at ${institute.name} (Invoice: ${invoice.invoiceNumber})`,
      });

      return {
        enrollment: savedEnrollment,
        invoice,
      };
    });
  }

  async getMyEnrollments(userId: string) {
    return await this.enrollmentRepo.find({
      where: { userId },
      relations: {
        courseInstitute: {
          course: true,
          institute: true,
        },
        invoices: true,
        payments: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  // --- 7. Invoices & Download ---
  async getMyInvoices(userId: string) {
    return await this.invoicesService.getInvoices({
      id: userId,
      role: 'SEAFARER',
    });
  }

  // --- 8. Support Tickets ---
  async getSupportTickets(userId: string) {
    return await this.ticketRepo.find({
      where: { userId },
      relations: {
        replies: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async createSupportTicket(userId: string, data: any) {
    const ticketNumber = `TCK-${Date.now().toString().slice(-6)}`;
    const ticket = this.ticketRepo.create({
      ticketNumber,
      userId,
      subject: data.subject || 'Seafarer Support Inquiry',
      category: data.category || 'Course / Certification',
      priority: data.priority || 'Normal',
      status: 'Open' as any,
    });

    const saved = await this.ticketRepo.save(ticket);

    if (data.message) {
      const reply = this.replyRepo.create({
        ticketId: saved.id,
        senderUserId: userId,
        message: data.message,
        isStaffReply: false,
      });
      await this.replyRepo.save(reply);
    }

    return saved;
  }
}
