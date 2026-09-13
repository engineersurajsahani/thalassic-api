import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PartnerCoursePricing,
  PartnerPricingProposal,
  PricingProposalStatus,
  Course,
  Partner,
  AuditLog,
  User,
} from '../../entities';

export interface CoursePricingDto {
  id: string;
  partnerId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  category: string;
  standardFee: number;
  activePayableAmount: number;
  proposedPayableAmount?: number | null;
  proposedDate?: string | null;
  status: 'Active' | 'Pending Approval' | 'Rejected';
  rejectionReason?: string;
  lastUpdated: string;
}

@Injectable()
export class PartnerPricingService {
  constructor(
    @InjectRepository(PartnerCoursePricing)
    private readonly pricingRepo: Repository<PartnerCoursePricing>,
    @InjectRepository(PartnerPricingProposal)
    private readonly proposalRepo: Repository<PartnerPricingProposal>,
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,
    @InjectRepository(Partner)
    private readonly partnerRepo: Repository<Partner>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getAllPricings(partnerId?: string): Promise<CoursePricingDto[]> {
    const courses = await this.courseRepo.find({
      order: { code: 'ASC' },
    });

    let effectivePartnerId = partnerId;
    if (!effectivePartnerId) {
      const firstPartner = await this.partnerRepo.findOne({
        where: {},
        order: { createdAt: 'ASC' },
      });
      effectivePartnerId = firstPartner?.id;
    }

    if (!effectivePartnerId) {
      return courses.map((c) => ({
        id: c.id,
        partnerId: '',
        courseId: c.id,
        courseCode: c.code,
        courseName: c.name,
        category: c.category,
        standardFee: Number(c.standardFee),
        activePayableAmount: Number(c.standardFee),
        proposedPayableAmount: null,
        proposedDate: null,
        status: 'Active',
        lastUpdated: c.updatedAt?.toISOString() || new Date().toISOString(),
      }));
    }

    const pricings = await this.pricingRepo.find({
      where: { partnerId: effectivePartnerId },
      relations: {
        course: true,
      },
    });

    const pendingProposals = await this.proposalRepo.find({
      where: {
        partnerId: effectivePartnerId,
        status: PricingProposalStatus.PENDING_MASTER_APPROVAL,
      },
      order: { requestedAt: 'DESC' },
    });

    const pricingMap = new Map(pricings.map((p) => [p.courseId, p]));
    const proposalMap = new Map(pendingProposals.map((p) => [p.courseId, p]));

    return courses.map((course) => {
      const pricing = pricingMap.get(course.id);
      const pendingProposal = proposalMap.get(course.id);

      const activeAmount = pricing
        ? Number(pricing.activePayableAmount)
        : Number(course.standardFee);

      let status: 'Active' | 'Pending Approval' | 'Rejected' = 'Active';
      let proposedPayableAmount: number | null = null;
      let proposedDate: string | null = null;
      let rejectionReason: string | undefined = undefined;

      if (pendingProposal) {
        status = 'Pending Approval';
        proposedPayableAmount = Number(pendingProposal.proposedPayableAmount);
        proposedDate = pendingProposal.requestedAt.toISOString();
      }

      return {
        id: course.id,
        partnerId: effectivePartnerId!,
        courseId: course.id,
        courseCode: course.code,
        courseName: course.name,
        category: course.category,
        standardFee: Number(course.standardFee),
        activePayableAmount: activeAmount,
        proposedPayableAmount,
        proposedDate,
        status,
        rejectionReason,
        lastUpdated:
          pricing?.updatedAt?.toISOString() ||
          course.updatedAt?.toISOString() ||
          new Date().toISOString(),
      };
    });
  }

  async getPricingById(
    courseId: string,
    partnerId?: string,
  ): Promise<CoursePricingDto> {
    const list = await this.getAllPricings(partnerId);
    const item = list.find((x) => x.courseId === courseId || x.id === courseId);
    if (!item) {
      throw new NotFoundException(`Pricing for course ${courseId} not found.`);
    }
    return item;
  }

  async getPendingProposals(
    partnerId?: string,
  ): Promise<PartnerPricingProposal[]> {
    const where: any = {
      status: PricingProposalStatus.PENDING_MASTER_APPROVAL,
    };
    if (partnerId) {
      where.partnerId = partnerId;
    }
    return this.proposalRepo.find({
      where,
      relations: {
        partner: true,
        course: true,
        requestedBy: true,
      },
      order: { requestedAt: 'DESC' },
    });
  }

  async proposePrice(
    courseId: string,
    proposedPayableAmount: number,
    partnerId?: string,
    justificationReason?: string,
    requestedByUserId?: string,
  ): Promise<CoursePricingDto> {
    if (!proposedPayableAmount || proposedPayableAmount <= 0) {
      throw new BadRequestException(
        'Proposed payable amount must be greater than 0.',
      );
    }

    const course = await this.courseRepo.findOne({ where: { id: courseId } });
    if (!course) {
      throw new NotFoundException(`Course ${courseId} not found.`);
    }

    let targetPartnerId = partnerId;
    if (!targetPartnerId) {
      const firstPartner = await this.partnerRepo.findOne({
        where: {},
        order: { createdAt: 'ASC' },
      });
      if (!firstPartner) {
        throw new NotFoundException('No partner found in system.');
      }
      targetPartnerId = firstPartner.id;
    }

    const currentPricing = await this.pricingRepo.findOne({
      where: { partnerId: targetPartnerId, courseId: course.id },
    });

    const previousAmount = currentPricing
      ? Number(currentPricing.activePayableAmount)
      : Number(course.standardFee);

    const proposal = this.proposalRepo.create({
      partnerId: targetPartnerId,
      courseId: course.id,
      proposedPayableAmount,
      previousPayableAmount: previousAmount,
      justificationReason:
        justificationReason || 'Partner requested custom Hari Om payable rate.',
      status: PricingProposalStatus.PENDING_MASTER_APPROVAL,
      requestedByUserId: requestedByUserId || null,
      requestedAt: new Date(),
    });

    await this.proposalRepo.save(proposal);

    await this.auditLogRepo.save({
      actorUserId: requestedByUserId || null,
      action: 'PROPOSE_HARI_OM_PAYABLE',
      module: 'PARTNER_PRICING',
      entityTable: 'partner_pricing_proposals',
      entityId: proposal.id,
      partnerId: targetPartnerId,
      details: `Partner proposed Hari Om Payable of ₹${proposedPayableAmount} for course ${course.code} (Previous: ₹${previousAmount})`,
      previousState: { activePayableAmount: previousAmount },
      newState: { proposedPayableAmount },
    });

    return this.getPricingById(course.id, targetPartnerId);
  }

  async approveProposal(
    proposalId: string,
    reviewedByUserId: string,
    reviewNotes?: string,
  ): Promise<PartnerPricingProposal> {
    const proposal = await this.proposalRepo.findOne({
      where: { id: proposalId },
      relations: {
        partner: true,
        course: true,
      },
    });

    if (!proposal) {
      throw new NotFoundException(`Pricing proposal ${proposalId} not found.`);
    }

    if (proposal.status !== PricingProposalStatus.PENDING_MASTER_APPROVAL) {
      throw new BadRequestException(`Proposal is already ${proposal.status}.`);
    }

    proposal.status = PricingProposalStatus.APPROVED;
    proposal.reviewedByUserId = reviewedByUserId;
    proposal.reviewedAt = new Date();
    proposal.reviewNotes = reviewNotes || 'Approved by Master Administrator.';
    await this.proposalRepo.save(proposal);

    let pricing = await this.pricingRepo.findOne({
      where: { partnerId: proposal.partnerId, courseId: proposal.courseId },
    });

    const prevPayable = pricing ? Number(pricing.activePayableAmount) : null;

    if (!pricing) {
      pricing = this.pricingRepo.create({
        partnerId: proposal.partnerId,
        courseId: proposal.courseId,
        activePayableAmount: proposal.proposedPayableAmount,
        effectiveDate: new Date(),
      });
    } else {
      pricing.activePayableAmount = proposal.proposedPayableAmount;
      pricing.effectiveDate = new Date();
    }

    await this.pricingRepo.save(pricing);

    await this.auditLogRepo.save({
      actorUserId: reviewedByUserId,
      action: 'APPROVE_HARI_OM_PAYABLE',
      module: 'PARTNER_PRICING',
      entityTable: 'partner_course_pricings',
      entityId: pricing.id,
      partnerId: proposal.partnerId,
      details: `Master approved Hari Om Payable ₹${proposal.proposedPayableAmount} for course ${proposal.course?.code || proposal.courseId}`,
      previousState: { activePayableAmount: prevPayable },
      newState: { activePayableAmount: proposal.proposedPayableAmount },
    });

    return proposal;
  }

  async rejectProposal(
    proposalId: string,
    reviewedByUserId: string,
    rejectionReason: string,
  ): Promise<PartnerPricingProposal> {
    if (!rejectionReason || !rejectionReason.trim()) {
      throw new BadRequestException('Rejection reason is required.');
    }

    const proposal = await this.proposalRepo.findOne({
      where: { id: proposalId },
      relations: {
        partner: true,
        course: true,
      },
    });

    if (!proposal) {
      throw new NotFoundException(`Pricing proposal ${proposalId} not found.`);
    }

    if (proposal.status !== PricingProposalStatus.PENDING_MASTER_APPROVAL) {
      throw new BadRequestException(`Proposal is already ${proposal.status}.`);
    }

    proposal.status = PricingProposalStatus.REJECTED;
    proposal.reviewedByUserId = reviewedByUserId;
    proposal.reviewedAt = new Date();
    proposal.reviewNotes = rejectionReason;
    await this.proposalRepo.save(proposal);

    await this.auditLogRepo.save({
      actorUserId: reviewedByUserId,
      action: 'REJECT_HARI_OM_PAYABLE',
      module: 'PARTNER_PRICING',
      entityTable: 'partner_pricing_proposals',
      entityId: proposal.id,
      partnerId: proposal.partnerId,
      details: `Master rejected Hari Om Payable proposal for course ${proposal.course?.code || proposal.courseId}. Reason: ${rejectionReason}`,
      previousState: { status: PricingProposalStatus.PENDING_MASTER_APPROVAL },
      newState: { status: PricingProposalStatus.REJECTED, rejectionReason },
    });

    return proposal;
  }

  async approvePrice(
    courseId: string,
    partnerId?: string,
    reviewedByUserId?: string,
  ): Promise<CoursePricingDto> {
    const list = await this.getAllPricings(partnerId);
    const item = list.find((x) => x.courseId === courseId || x.id === courseId);
    if (!item) throw new NotFoundException(`Course ${courseId} not found.`);

    const targetPartnerId = item.partnerId || partnerId;
    const pendingProposal = await this.proposalRepo.findOne({
      where: {
        partnerId: targetPartnerId,
        courseId: item.courseId,
        status: PricingProposalStatus.PENDING_MASTER_APPROVAL,
      },
      order: { requestedAt: 'DESC' },
    });

    if (pendingProposal) {
      await this.approveProposal(
        pendingProposal.id,
        reviewedByUserId || 'system',
      );
    } else {
      let pricing = await this.pricingRepo.findOne({
        where: { partnerId: targetPartnerId, courseId: item.courseId },
      });
      if (!pricing) {
        pricing = this.pricingRepo.create({
          partnerId: targetPartnerId,
          courseId: item.courseId,
          activePayableAmount: item.activePayableAmount,
          effectiveDate: new Date(),
        });
      }
      await this.pricingRepo.save(pricing);
    }

    return this.getPricingById(item.courseId, targetPartnerId);
  }

  async rejectPrice(
    courseId: string,
    reason?: string,
    partnerId?: string,
    reviewedByUserId?: string,
  ): Promise<CoursePricingDto> {
    const list = await this.getAllPricings(partnerId);
    const item = list.find((x) => x.courseId === courseId || x.id === courseId);
    if (!item) throw new NotFoundException(`Course ${courseId} not found.`);

    const targetPartnerId = item.partnerId || partnerId;
    const pendingProposal = await this.proposalRepo.findOne({
      where: {
        partnerId: targetPartnerId,
        courseId: item.courseId,
        status: PricingProposalStatus.PENDING_MASTER_APPROVAL,
      },
      order: { requestedAt: 'DESC' },
    });

    if (pendingProposal) {
      await this.rejectProposal(
        pendingProposal.id,
        reviewedByUserId || 'system',
        reason || 'Proposal rejected by Master Admin.',
      );
    }

    return this.getPricingById(item.courseId, targetPartnerId);
  }
}
