import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { Partner } from './partner.entity';
import { Enrollment } from './enrollment.entity';
import { Invoice } from './invoice.entity';
import { Course } from './course.entity';
import { User } from './user.entity';
import { PartnerPricingProposal } from './partner-pricing-proposal.entity';
import { SettlementItem } from './settlement-item.entity';

export enum PayableStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  SETTLED = 'Settled',
  CANCELLED = 'Cancelled',
}

@Entity('partner_payables')
export class PartnerPayable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'partner_id', type: 'uuid' })
  partnerId: string;

  @Column({ name: 'enrollment_id', type: 'uuid', unique: true })
  enrollmentId: string;

  @Column({ name: 'invoice_id', type: 'uuid', nullable: true })
  invoiceId: string | null;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId: string;

  @Column({ name: 'seafarer_user_id', type: 'uuid' })
  seafarerUserId: string;

  @Column({
    name: 'approved_payable_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
  })
  approvedPayableAmount: number; // Approved snapshotted Hari Om Payable amount

  @Column({ name: 'pricing_proposal_id', type: 'uuid', nullable: true })
  pricingProposalId: string | null;

  @Column({
    enum: PayableStatus,
    default: PayableStatus.PENDING,
  })
  status: PayableStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Partner, (p) => p.payables, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partner_id' })
  partner: Partner;

  @OneToOne(() => Enrollment, (e) => e.partnerPayable, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'enrollment_id' })
  enrollment: Enrollment;

  @ManyToOne(() => Invoice, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice | null;

  @ManyToOne(() => Course, (c) => c.partnerPayables, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course: Course;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seafarer_user_id' })
  seafarerUser: User;

  @ManyToOne(() => PartnerPricingProposal, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'pricing_proposal_id' })
  pricingProposal: PartnerPricingProposal | null;

  @OneToOne(() => SettlementItem, (si) => si.payable)
  settlementItem: SettlementItem;
}
