import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Invoice,
  InvoiceType,
  InvoiceStatus,
  InvoiceCounter,
  Payment,
  PaymentStatus,
  PaymentMethod,
  AuditLog,
  PlatformSettings,
  User,
  Partner,
  Enrollment,
} from '../../entities';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoiceCounter)
    private readonly counterRepo: Repository<InvoiceCounter>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(PlatformSettings)
    private readonly settingsRepo: Repository<PlatformSettings>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Partner)
    private readonly partnerRepo: Repository<Partner>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    private readonly dataSource: DataSource,
  ) {}

  // Atomic sequential invoice number generator using database row locking
  async generateNextInvoiceNumber(type: InvoiceType): Promise<string> {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const ym = `${yy}${mm}`;
    const prefix = type;

    return await this.dataSource.transaction(async (manager) => {
      let counter = await manager.findOne(InvoiceCounter, {
        where: { yearMonth: ym },
        lock: { mode: 'pessimistic_write' },
      });

      if (!counter) {
        counter = manager.create(InvoiceCounter, {
          yearMonth: ym,
          hocCounter: 0,
          hacCounter: 0,
          companyCounter: 0,
        });
        await manager.save(counter);
        counter = await manager.findOne(InvoiceCounter, {
          where: { yearMonth: ym },
          lock: { mode: 'pessimistic_write' },
        });
      }

      let nextNum = 1;
      if (type === InvoiceType.HOC) {
        counter!.hocCounter += 1;
        nextNum = counter!.hocCounter;
      } else if (type === InvoiceType.HAC) {
        counter!.hacCounter += 1;
        nextNum = counter!.hacCounter;
      } else {
        counter!.companyCounter += 1;
        nextNum = counter!.companyCounter;
      }

      await manager.save(counter);
      const seqStr = String(nextNum).padStart(5, '0');
      return `${prefix}${ym}${seqStr}`;
    });
  }

  async generateInvoice(params: {
    userId?: string;
    partnerId?: string;
    companyId?: string;
    enrollmentId?: string;
    invoiceType?: InvoiceType;
    totalAmount: number;
    taxAmount?: number;
    discountAmount?: number;
    netPayable?: number;
    paymentMethod?: PaymentMethod;
    gatewayTransactionId?: string;
    gatewayOrderId?: string;
    actorUserId?: string;
  }): Promise<Invoice> {
    const {
      userId,
      partnerId,
      companyId,
      enrollmentId,
      totalAmount,
      taxAmount = 0,
      discountAmount = 0,
      paymentMethod = PaymentMethod.RAZORPAY,
      gatewayTransactionId,
      gatewayOrderId,
      actorUserId,
    } = params;

    let invoiceType = params.invoiceType;
    if (!invoiceType) {
      if (companyId) {
        invoiceType = InvoiceType.COMPANY;
      } else if (partnerId) {
        invoiceType = InvoiceType.HAC;
      } else {
        invoiceType = InvoiceType.HOC;
      }
    }

    const netPayable =
      params.netPayable ?? totalAmount + taxAmount - discountAmount;
    const invoiceNumber = await this.generateNextInvoiceNumber(invoiceType);

    const invoice = this.invoiceRepo.create({
      invoiceNumber,
      invoiceType,
      userId: userId || null,
      partnerId: partnerId || null,
      companyId: companyId || null,
      enrollmentId: enrollmentId || null,
      totalAmount,
      taxAmount,
      discountAmount,
      netPayable,
      status: InvoiceStatus.PAID,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      paidDate: new Date().toISOString().split('T')[0],
    });

    const savedInvoice = await this.invoiceRepo.save(invoice);

    // Record corresponding payment transaction receipt
    if (gatewayTransactionId || netPayable > 0) {
      const paymentNumber = `PAY-${Date.now().toString().slice(-8)}`;
      const payment = this.paymentRepo.create({
        paymentNumber,
        invoiceId: savedInvoice.id,
        enrollmentId: enrollmentId || null,
        userId: userId || null,
        partnerId: partnerId || null,
        companyId: companyId || null,
        amount: netPayable,
        paymentMethod,
        gatewayTransactionId: gatewayTransactionId || `GATEWAY-${Date.now()}`,
        gatewayOrderId: gatewayOrderId || null,
        status: PaymentStatus.SUCCESSFUL,
        paidAt: new Date(),
      });
      await this.paymentRepo.save(payment);
    }

    // Audit log
    await this.auditLogRepo.save({
      actorUserId: actorUserId || userId || null,
      action: 'INVOICE_GENERATED',
      module: 'INVOICES',
      entityTable: 'invoices',
      entityId: savedInvoice.id,
      partnerId: partnerId || null,
      companyId: companyId || null,
      details: `Generated ${invoiceType} Invoice ${invoiceNumber} for amount ₹${netPayable}`,
      newState: {
        invoiceNumber,
        totalAmount,
        netPayable,
        status: InvoiceStatus.PAID,
      },
    });

    return savedInvoice;
  }

  async getInvoices(user: any, query: any = {}) {
    const { search, type, status, startDate, endDate } = query;
    const role = (user?.role || '').toUpperCase().replace('-', '_');

    const qb = this.invoiceRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.user', 'user')
      .leftJoinAndSelect('inv.partner', 'partner')
      .leftJoinAndSelect('inv.company', 'company')
      .leftJoinAndSelect('inv.enrollment', 'enrollment')
      .leftJoinAndSelect('enrollment.courseInstitute', 'courseInstitute')
      .leftJoinAndSelect('courseInstitute.course', 'course')
      .orderBy('inv.createdAt', 'DESC');

    if (role === 'SEAFARER') {
      qb.andWhere('inv.userId = :userId', { userId: user.id });
    } else if (
      role === 'PARTNER_ADMIN' ||
      role === 'AGENT_ADMIN' ||
      role === 'AGENT'
    ) {
      // Find partner ID mapped to user
      const partner = await this.partnerRepo
        .createQueryBuilder('p')
        .innerJoin('partner_admins', 'pa', 'pa.partner_id = p.id')
        .where('pa.user_id = :userId', { userId: user.id })
        .getOne();

      if (partner) {
        qb.andWhere('inv.partnerId = :partnerId', { partnerId: partner.id });
      } else {
        qb.andWhere('inv.partnerId = :userId', { userId: user.id });
      }
    } else if (role === 'COMPANY_ADMIN') {
      const companyAdmin = await this.dataSource
        .getRepository('company_admins')
        .findOne({ where: { userId: user.id } });
      if (companyAdmin) {
        qb.andWhere('inv.companyId = :companyId', {
          companyId: (companyAdmin as any).companyId,
        });
      }
    }

    if (type && type !== 'all') {
      qb.andWhere('inv.invoiceType = :type', { type: type.toUpperCase() });
    }

    if (status && status !== 'all') {
      qb.andWhere('inv.status = :status', { status });
    }

    if (startDate) {
      qb.andWhere('inv.createdAt >= :startDate', {
        startDate: new Date(startDate),
      });
    }

    if (endDate) {
      qb.andWhere('inv.createdAt <= :endDate', { endDate: new Date(endDate) });
    }

    if (search && search.trim()) {
      const s = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(inv.invoiceNumber) LIKE :s OR LOWER(user.name) LIKE :s OR LOWER(partner.agencyName) LIKE :s OR LOWER(company.name) LIKE :s)',
        { s },
      );
    }

    const invoices = await qb.getMany();

    // Map to normalized response for API consumers
    return invoices.map((inv) => ({
      id: inv.id,
      invoice_number: inv.invoiceNumber,
      invoice_type: inv.invoiceType,
      status: inv.status,
      total_amount: Number(inv.totalAmount),
      tax_amount: Number(inv.taxAmount),
      discount_amount: Number(inv.discountAmount),
      net_payable: Number(inv.netPayable),
      final_amount: Number(inv.netPayable),
      course_fee: Number(inv.totalAmount),
      customer_name: inv.user?.name || 'Walk-in Seafarer',
      customer_email: inv.user?.email || '',
      customer_phone: inv.user?.phone || '',
      agent_name: inv.partner?.agencyName || null,
      partner_name: inv.partner?.agencyName || null,
      company_name: inv.company?.name || null,
      course_name:
        inv.enrollment?.courseInstitute?.course?.name ||
        'Maritime STCW Training',
      payment_date: inv.paidDate || inv.createdAt,
      created_at: inv.createdAt,
      pdf_url: inv.pdfUrl || null,
    }));
  }

  async getInvoiceById(id: string, user: any) {
    const inv = await this.invoiceRepo.findOne({
      where: [{ id }, { invoiceNumber: id }],
      relations: {
        user: true,
        partner: true,
        company: true,
        enrollment: {
          courseInstitute: {
            course: true,
          },
        },
        payments: true,
      },
    });

    if (!inv) {
      throw new NotFoundException(`Invoice ${id} not found.`);
    }

    const role = (user?.role || '').toUpperCase().replace('-', '_');
    if (role === 'SEAFARER' && inv.userId !== user.id) {
      throw new ForbiddenException(
        'You are not authorized to view this invoice',
      );
    }

    return {
      id: inv.id,
      invoice_number: inv.invoiceNumber,
      invoice_type: inv.invoiceType,
      status: inv.status,
      total_amount: Number(inv.totalAmount),
      tax_amount: Number(inv.taxAmount),
      discount_amount: Number(inv.discountAmount),
      net_payable: Number(inv.netPayable),
      final_amount: Number(inv.netPayable),
      course_fee: Number(inv.totalAmount),
      issue_date: inv.issueDate,
      due_date: inv.dueDate,
      paid_date: inv.paidDate,
      customer_name: inv.user?.name || 'Walk-in Seafarer',
      customer_email: inv.user?.email || '',
      customer_phone: inv.user?.phone || '',
      agent_name: inv.partner?.agencyName || null,
      partner_name: inv.partner?.agencyName || null,
      company_name: inv.company?.name || null,
      course_name:
        inv.enrollment?.courseInstitute?.course?.name ||
        'Maritime STCW Training',
      payments: inv.payments || [],
      created_at: inv.createdAt,
      pdf_url: inv.pdfUrl || null,
    };
  }

  async getInvoicePdf(id: string, user: any) {
    const invoice = await this.getInvoiceById(id, user);
    const settings = await this.settingsRepo.findOne({ where: {} });

    return {
      invoice,
      company: {
        name: 'Hari Om Thalassic Maritime Training Institute',
        address:
          'Suite 404, Marine Trade Tower, Ballard Estate, Mumbai, Maharashtra 400001',
        email: settings?.systemEmail || 'support@hariomthalassic.com',
        phone: settings?.contactPhone || '+91 22 12345678',
        dgsAccreditationId: settings?.dgsAccreditationId || 'DGS-MTI-10294',
        gstin: settings?.gstin || '27AABCH1234F1Z5',
      },
      terms: [
        'Fees once paid are non-refundable except under DGS guidelines.',
        'Please retain this tax invoice for certificate verification.',
        'This is a computer-generated tax invoice and requires no physical signature.',
      ],
    };
  }

  async exportInvoices(user: any, query: any = {}) {
    const list = await this.getInvoices(user, query);
    return list.map((inv: any) => ({
      'Invoice Number': inv.invoice_number,
      'Invoice Type': inv.invoice_type,
      Status: inv.status,
      Date: new Date(inv.created_at).toLocaleDateString('en-IN'),
      'Customer Name': inv.customer_name,
      'Customer Email': inv.customer_email,
      'Course Name': inv.course_name,
      Amount: `₹${inv.net_payable.toLocaleString('en-IN')}`,
      'Partner / Agency': inv.partner_name || 'Direct',
      Company: inv.company_name || 'Individual',
    }));
  }

  async updateInvoice() {
    throw new BadRequestException(
      'Financial Integrity: Invoices are immutable legal documents and cannot be edited.',
    );
  }

  async deleteInvoice() {
    throw new BadRequestException(
      'Financial Integrity: Historical invoices cannot be deleted.',
    );
  }
}
