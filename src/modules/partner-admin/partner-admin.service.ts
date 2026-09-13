import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Partner,
  PartnerAdmin,
  PartnerReferral,
  PartnerCoursePricing,
  PartnerPricingProposal,
  PartnerPayable,
  PayableStatus,
  Settlement,
  SettlementStatus,
  SettlementItem,
  User,
  AuditLog,
  Course,
} from '../../entities';

@Injectable()
export class PartnerAdminService {
  constructor(
    @InjectRepository(Partner)
    private readonly partnerRepo: Repository<Partner>,
    @InjectRepository(PartnerAdmin)
    private readonly partnerAdminRepo: Repository<PartnerAdmin>,
    @InjectRepository(PartnerReferral)
    private readonly referralRepo: Repository<PartnerReferral>,
    @InjectRepository(PartnerCoursePricing)
    private readonly pricingRepo: Repository<PartnerCoursePricing>,
    @InjectRepository(PartnerPricingProposal)
    private readonly proposalRepo: Repository<PartnerPricingProposal>,
    @InjectRepository(PartnerPayable)
    private readonly payableRepo: Repository<PartnerPayable>,
    @InjectRepository(Settlement)
    private readonly settlementRepo: Repository<Settlement>,
    @InjectRepository(SettlementItem)
    private readonly settlementItemRepo: Repository<SettlementItem>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,
    private readonly dataSource: DataSource,
  ) {}

  // --- 1. List & View Partners ---
  async getAllPartners() {
    const partners = await this.partnerRepo.find({
      relations: {
        partnerAdmins: {
          user: true,
        },
        referrals: true,
        payables: true,
      },
      order: { createdAt: 'DESC' },
    });

    return partners.map((p) => ({
      id: p.id,
      agencyName: p.agencyName,
      contactPerson: p.contactPerson,
      contactEmail: p.contactEmail,
      contactPhone: p.contactPhone,
      city: p.city,
      state: p.state,
      referralCode: p.referralCode,
      onboardingStatus: p.onboardingStatus,
      totalReferrals: (p.referrals || []).length,
      totalPayables: (p.payables || []).reduce(
        (s, pay) => s + Number(pay.approvedPayableAmount),
        0,
      ),
      createdAt: p.createdAt,
    }));
  }

  async getPartnerById(id: string) {
    const partner = await this.partnerRepo.findOne({
      where: { id },
      relations: {
        partnerAdmins: {
          user: true,
        },
        referrals: true,
        payables: true,
        settlements: true,
      },
    });

    if (!partner) {
      throw new NotFoundException(`Partner ${id} not found.`);
    }

    return partner;
  }

  // --- 2. Partner Onboarding & Applications ---
  async updatePartnerStatus(
    partnerId: string,
    status: string,
    reviewerUserId?: string,
  ) {
    const partner = await this.partnerRepo.findOne({
      where: { id: partnerId },
    });
    if (!partner)
      throw new NotFoundException(`Partner ${partnerId} not found.`);

    partner.onboardingStatus = status;
    const saved = await this.partnerRepo.save(partner);

    await this.auditLogRepo.save({
      actorUserId: reviewerUserId || null,
      action: 'UPDATE_PARTNER_STATUS',
      module: 'PARTNER_ADMIN',
      entityTable: 'partners',
      entityId: partner.id,
      partnerId: partner.id,
      details: `Partner ${partner.agencyName} onboarding status set to ${status}`,
    });

    return saved;
  }

  // --- 3. Manage Settlements (Approve, Disburse) ---
  async getAllSettlements() {
    const settlements = await this.settlementRepo.find({
      relations: {
        partner: true,
        items: {
          payable: {
            course: true,
          },
        },
        processedByUser: true,
      },
      order: { createdAt: 'DESC' },
    });

    return settlements.map((s) => ({
      id: s.id,
      settlementNumber: s.settlementNumber,
      partnerId: s.partnerId,
      partnerName: s.partner?.agencyName || 'Partner Agency',
      totalAmount: Number(s.totalAmount),
      totalItems: s.totalItems,
      status: s.status,
      paymentReference: s.paymentReference,
      processedBy: s.processedByUser?.name || 'Master Admin',
      processedAt: s.processedAt,
      createdAt: s.createdAt,
    }));
  }

  async approveSettlement(settlementId: string, reviewerUserId: string) {
    const settlement = await this.settlementRepo.findOne({
      where: { id: settlementId },
    });

    if (!settlement)
      throw new NotFoundException(`Settlement ${settlementId} not found.`);

    settlement.status = SettlementStatus.APPROVED;
    settlement.processedByUserId = reviewerUserId;
    const saved = await this.settlementRepo.save(settlement);

    await this.auditLogRepo.save({
      actorUserId: reviewerUserId,
      action: 'APPROVE_SETTLEMENT',
      module: 'SETTLEMENTS',
      entityTable: 'settlements',
      entityId: settlement.id,
      partnerId: settlement.partnerId,
      details: `Master approved settlement batch ${settlement.settlementNumber} for ₹${settlement.totalAmount}`,
    });

    return saved;
  }

  async disburseSettlement(
    settlementId: string,
    paymentReference: string,
    reviewerUserId: string,
    notes?: string,
  ) {
    const settlement = await this.settlementRepo.findOne({
      where: { id: settlementId },
      relations: {
        items: {
          payable: true,
        },
      },
    });

    if (!settlement)
      throw new NotFoundException(`Settlement ${settlementId} not found.`);

    return await this.dataSource.transaction(async (manager) => {
      settlement.status = SettlementStatus.PAID;
      settlement.paymentReference = paymentReference;
      settlement.processedByUserId = reviewerUserId;
      settlement.processedAt = new Date();
      if (notes) settlement.notes = notes;

      const savedSettlement = await manager.save(settlement);

      if (settlement.items && settlement.items.length > 0) {
        for (const item of settlement.items) {
          if (item.payableId) {
            await manager.update(
              PartnerPayable,
              { id: item.payableId },
              { status: PayableStatus.SETTLED, updatedAt: new Date() },
            );
          }
        }
      }

      await this.auditLogRepo.save({
        actorUserId: reviewerUserId,
        action: 'DISBURSE_SETTLEMENT',
        module: 'SETTLEMENTS',
        entityTable: 'settlements',
        entityId: settlement.id,
        partnerId: settlement.partnerId,
        details: `Disbursed settlement batch ${settlement.settlementNumber} of ₹${settlement.totalAmount} (Ref: ${paymentReference})`,
      });

      return savedSettlement;
    });
  }
}
