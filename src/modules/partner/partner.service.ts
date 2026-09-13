import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import {
  Partner,
  PartnerAdmin,
  PartnerReferral,
  ReferralStatus,
  PartnerCoursePricing,
  PartnerPricingProposal,
  PartnerPayable,
  PayableStatus,
  Settlement,
  SettlementStatus,
  SettlementItem,
  User,
  Course,
  Document,
  SupportTicket,
  SupportTicketReply,
  Notification,
  AuditLog,
} from '../../entities';

@Injectable()
export class PartnerService {
  constructor(
    @InjectRepository(Partner)
    private readonly partnerRepo: Repository<Partner>,
    @InjectRepository(PartnerAdmin)
    private readonly partnerAdminRepo: Repository<PartnerAdmin>,
    @InjectRepository(PartnerReferral)
    private readonly referralRepo: Repository<PartnerReferral>,
    @InjectRepository(PartnerCoursePricing)
    private readonly pricingRepo: Repository<PartnerCoursePricing>,
    @InjectRepository(PartnerPayable)
    private readonly payableRepo: Repository<PartnerPayable>,
    @InjectRepository(Settlement)
    private readonly settlementRepo: Repository<Settlement>,
    @InjectRepository(SettlementItem)
    private readonly settlementItemRepo: Repository<SettlementItem>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(SupportTicket)
    private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(SupportTicketReply)
    private readonly replyRepo: Repository<SupportTicketReply>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly dataSource: DataSource,
  ) {}

  // Helper: Find partner record associated with user
  async getPartnerForUser(userId: string): Promise<Partner> {
    const adminLink = await this.partnerAdminRepo.findOne({
      where: { userId },
      relations: {
        partner: true,
      },
    });

    if (adminLink?.partner) {
      return adminLink.partner;
    }

    const direct = await this.partnerRepo.findOne({
      where: [{ id: userId }, { contactEmail: userId }],
    });
    if (direct) return direct;

    const fallback = await this.partnerRepo.findOne({
      where: {},
      order: { createdAt: 'ASC' },
    });
    if (fallback) return fallback;

    const newPartner = this.partnerRepo.create({
      agencyName: 'Hari Om Manning & Career Partner',
      contactPerson: 'Partner Administrator',
      contactEmail: 'partner@thalassic.in',
      contactPhone: '+91 99999 88888',
      referralCode: 'REF-PARTNER-01',
      onboardingStatus: 'Active',
    });
    return await this.partnerRepo.save(newPartner);
  }

  // --- 1. Dashboard Overview ---
  async getDashboard(userId: string) {
    const partner = await this.getPartnerForUser(userId);

    const referrals = await this.referralRepo.find({
      where: { partnerId: partner.id },
      order: { createdAt: 'DESC' },
    });

    const payables = await this.payableRepo.find({
      where: { partnerId: partner.id },
      relations: {
        course: true,
        seafarerUser: true,
        invoice: true,
      },
      order: { createdAt: 'DESC' },
    });

    const settlements = await this.settlementRepo.find({
      where: { partnerId: partner.id },
      order: { createdAt: 'DESC' },
    });

    const totalReferrals = referrals.length;
    const activeReferrals = referrals.filter(
      (r) =>
        r.status === ReferralStatus.CONTACTED ||
        r.status === ReferralStatus.NEW,
    ).length;
    const convertedReferrals = referrals.filter(
      (r) => r.status === ReferralStatus.CONVERTED,
    ).length;

    const totalPayablesAmount = payables.reduce(
      (s, p) => s + Number(p.approvedPayableAmount),
      0,
    );
    const approvedPayablesAmount = payables
      .filter((p) => p.status === PayableStatus.APPROVED)
      .reduce((s, p) => s + Number(p.approvedPayableAmount), 0);
    const settledAmount = settlements
      .filter((s) => s.status === SettlementStatus.PAID)
      .reduce((s, st) => s + Number(st.totalAmount), 0);

    return {
      partner: {
        id: partner.id,
        agencyName: partner.agencyName,
        referralCode: partner.referralCode,
        qrCodeUrl: partner.qrCodeUrl,
        onboardingStatus: partner.onboardingStatus,
      },
      stats: {
        totalReferrals,
        activeReferrals,
        convertedReferrals,
        conversionRate:
          totalReferrals > 0
            ? ((convertedReferrals / totalReferrals) * 100).toFixed(1) + '%'
            : '0%',
        totalPayablesAmount,
        approvedPayablesAmount,
        settledAmount,
      },
      recentReferrals: referrals.slice(0, 5),
      recentPayables: payables.slice(0, 5),
      recentSettlements: settlements.slice(0, 5),
    };
  }

  // --- 2. Partner Metadata & Profile ---
  async getMetadata(userId: string) {
    const partner = await this.getPartnerForUser(userId);
    return {
      user_id: userId,
      partner_id: partner.id,
      agency_name: partner.agencyName,
      contact_person: partner.contactPerson,
      contact_email: partner.contactEmail,
      contact_phone: partner.contactPhone,
      alternate_phone: partner.alternatePhone,
      address: partner.address,
      city: partner.city,
      state: partner.state,
      country: partner.country,
      postal_code: partner.postalCode,
      referral_code: partner.referralCode,
      qr_code_url: partner.qrCodeUrl,
      onboarding_status: partner.onboardingStatus,
      license_number: partner.rpslLicenseNumber,
    };
  }

  async updateProfile(userId: string, data: any) {
    const partner = await this.getPartnerForUser(userId);

    if (data.agency_name || data.agencyName)
      partner.agencyName = data.agency_name || data.agencyName;
    if (data.contact_person || data.contactPerson)
      partner.contactPerson = data.contact_person || data.contactPerson;
    if (data.contact_phone || data.contactPhone)
      partner.contactPhone = data.contact_phone || data.contactPhone;
    if (data.alternate_phone || data.alternatePhone)
      partner.alternatePhone = data.alternate_phone || data.alternatePhone;
    if (data.address) partner.address = data.address;
    if (data.city) partner.city = data.city;
    if (data.state) partner.state = data.state;
    if (data.country) partner.country = data.country;
    if (data.postal_code || data.postalCode)
      partner.postalCode = data.postal_code || data.postalCode;
    if (data.license_number || data.rpslLicenseNumber)
      partner.rpslLicenseNumber = data.license_number || data.rpslLicenseNumber;

    const saved = await this.partnerRepo.save(partner);

    await this.auditLogRepo.save({
      actorUserId: userId,
      action: 'UPDATE_PARTNER_PROFILE',
      module: 'PARTNER',
      entityTable: 'partners',
      entityId: partner.id,
      partnerId: partner.id,
      details: `Updated partner profile for agency ${partner.agencyName}`,
    });

    return saved;
  }

  // --- 3. Referrals Management ---
  async getReferrals(userId: string) {
    const partner = await this.getPartnerForUser(userId);
    const leads = await this.referralRepo.find({
      where: { partnerId: partner.id },
      relations: {
        referredUser: true,
      },
      order: { createdAt: 'DESC' },
    });

    return leads.map((l) => ({
      id: l.id,
      agent_id: l.partnerId,
      partner_id: l.partnerId,
      name: l.fullName,
      full_name: l.fullName,
      email: l.email,
      phone: l.phone,
      course_interested: l.courseInterested,
      status: l.status,
      remarks: l.notes,
      notes: l.notes,
      created_at: l.createdAt,
      expiry_at: l.expiresAt,
      converted_at: l.convertedAt,
      referred_user_id: l.referredUserId,
    }));
  }

  async createReferral(userId: string, data: any) {
    const partner = await this.getPartnerForUser(userId);

    const referral = this.referralRepo.create({
      partnerId: partner.id,
      fullName: data.name || data.fullName || data.full_name,
      email: (data.email || '').trim().toLowerCase(),
      phone: data.phone || '',
      courseInterested: data.courseInterested || data.course_interested || null,
      notes: data.remarks || data.notes || null,
      status: ReferralStatus.NEW,
      expiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
    });

    const saved = await this.referralRepo.save(referral);

    await this.auditLogRepo.save({
      actorUserId: userId,
      action: 'CREATE_PARTNER_REFERRAL',
      module: 'PARTNER',
      entityTable: 'partner_referrals',
      entityId: saved.id,
      partnerId: partner.id,
      details: `Registered new candidate referral: ${saved.fullName} (${saved.email})`,
    });

    return saved;
  }

  async updateReferral(userId: string, referralId: string, data: any) {
    const partner = await this.getPartnerForUser(userId);
    const referral = await this.referralRepo.findOne({
      where: { id: referralId, partnerId: partner.id },
    });

    if (!referral) {
      throw new NotFoundException(`Referral lead ${referralId} not found.`);
    }

    if (data.status) referral.status = data.status;
    if (data.notes || data.remarks) referral.notes = data.notes || data.remarks;
    if (data.courseInterested || data.course_interested)
      referral.courseInterested =
        data.courseInterested || data.course_interested;
    if (data.status === ReferralStatus.CONVERTED && !referral.convertedAt) {
      referral.convertedAt = new Date();
    }

    return await this.referralRepo.save(referral);
  }

  // --- 4. Partner Payables Ledger ---
  async getPayables(userId: string) {
    const partner = await this.getPartnerForUser(userId);
    const payables = await this.payableRepo.find({
      where: { partnerId: partner.id },
      relations: {
        course: true,
        seafarerUser: true,
        invoice: true,
      },
      order: { createdAt: 'DESC' },
    });

    return payables.map((p) => ({
      id: p.id,
      partner_id: p.partnerId,
      enrollment_id: p.enrollmentId,
      invoice_id: p.invoiceId,
      invoice_number: p.invoice?.invoiceNumber || 'N/A',
      course_id: p.courseId,
      course_name: p.course?.name || 'Maritime Course',
      seafarer_name: p.seafarerUser?.name || 'Seafarer',
      approved_payable_amount: Number(p.approvedPayableAmount),
      status: p.status,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    }));
  }

  // --- 5. Settlements Management ---
  async getSettlements(userId: string) {
    const partner = await this.getPartnerForUser(userId);
    const settlements = await this.settlementRepo.find({
      where: { partnerId: partner.id },
      relations: {
        items: {
          payable: {
            course: true,
          },
        },
      },
      order: { createdAt: 'DESC' },
    });

    return settlements.map((s) => ({
      id: s.id,
      settlement_number: s.settlementNumber,
      partner_id: s.partnerId,
      total_amount: Number(s.totalAmount),
      total_items: s.totalItems,
      status: s.status,
      payment_reference: s.paymentReference,
      processed_at: s.processedAt,
      created_at: s.createdAt,
      items: (s.items || []).map((si) => ({
        id: si.id,
        payable_id: si.payableId,
        amount: Number(si.amount),
        course_name: si.payable?.course?.name || 'Training Course',
      })),
    }));
  }

  async requestSettlement(userId: string, payableIds?: string[]) {
    const partner = await this.getPartnerForUser(userId);

    let eligiblePayables: PartnerPayable[] = [];

    if (payableIds && payableIds.length > 0) {
      eligiblePayables = await this.payableRepo.find({
        where: {
          id: In(payableIds),
          partnerId: partner.id,
          status: PayableStatus.APPROVED,
        },
      });
    } else {
      eligiblePayables = await this.payableRepo.find({
        where: {
          partnerId: partner.id,
          status: PayableStatus.APPROVED,
        },
      });
    }

    if (eligiblePayables.length === 0) {
      throw new BadRequestException('No approved payables found to settle.');
    }

    const totalAmount = eligiblePayables.reduce(
      (s, p) => s + Number(p.approvedPayableAmount),
      0,
    );
    const settlementNumber = `STL-${new Date().toISOString().slice(2, 4)}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Math.floor(1000 + Math.random() * 9000))}`;

    return await this.dataSource.transaction(async (manager) => {
      const settlement = manager.create(Settlement, {
        settlementNumber,
        partnerId: partner.id,
        totalAmount,
        totalItems: eligiblePayables.length,
        status: SettlementStatus.PENDING,
      });

      const savedSettlement = await manager.save(settlement);

      for (const payable of eligiblePayables) {
        const item = manager.create(SettlementItem, {
          settlementId: savedSettlement.id,
          payableId: payable.id,
          amount: payable.approvedPayableAmount,
        });
        await manager.save(item);
      }

      await this.auditLogRepo.save({
        actorUserId: userId,
        action: 'REQUEST_SETTLEMENT',
        module: 'SETTLEMENTS',
        entityTable: 'settlements',
        entityId: savedSettlement.id,
        partnerId: partner.id,
        details: `Partner requested settlement batch ${settlementNumber} for ${eligiblePayables.length} items (Total ₹${totalAmount})`,
      });

      return savedSettlement;
    });
  }

  // --- 6. Documents & KYC ---
  async getDocuments(userId: string) {
    return await this.documentRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async uploadDocument(userId: string, data: any) {
    const doc = this.documentRepo.create({
      userId,
      type: data.type || 'KYC',
      name: data.name || 'Partner Document',
      filePath: data.filePath || data.file_path || '/documents/sample.pdf',
      fileSize: data.fileSize || data.file_size || 1024,
      mimeType: data.mimeType || data.mime_type || 'application/pdf',
      status: 'Pending',
      documentNumber: data.documentNumber || data.document_number || null,
      expiryDate: data.expiryDate || data.expiry_date || null,
    });

    return await this.documentRepo.save(doc);
  }

  // --- 7. Support Tickets & Conversations ---
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
      subject: data.subject || 'Partner Help Request',
      category: data.category || 'General Inquiry',
      priority: data.priority || 'Normal',
      status: 'Open' as any,
    });

    const savedTicket = await this.ticketRepo.save(ticket);

    if (data.message) {
      const reply = this.replyRepo.create({
        ticketId: savedTicket.id,
        senderUserId: userId,
        message: data.message,
        isStaffReply: false,
      });
      await this.replyRepo.save(reply);
    }

    return savedTicket;
  }

  async replySupportTicket(userId: string, ticketId: string, message: string) {
    const reply = this.replyRepo.create({
      ticketId,
      senderUserId: userId,
      message,
      isStaffReply: false,
    });
    return await this.replyRepo.save(reply);
  }

  // --- 8. Notifications ---
  async getNotifications(userId: string) {
    return await this.notificationRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async markNotificationRead(id: string) {
    return await this.notificationRepo.update(id, { isRead: true });
  }
}
