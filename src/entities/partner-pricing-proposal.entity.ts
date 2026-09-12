import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Partner } from './partner.entity';
import { Course } from './course.entity';
import { User } from './user.entity';

export enum PricingProposalStatus {
  PENDING_MASTER_APPROVAL = 'PENDING_MASTER_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('partner_pricing_proposals')
export class PartnerPricingProposal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'partner_id', type: 'uuid' })
  partnerId: string;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId: string;

  @Column({
    name: 'proposed_payable_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
  })
  proposedPayableAmount: number;

  @Column({
    name: 'previous_payable_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  previousPayableAmount: number | null;

  @Column({ name: 'justification_reason', type: 'text', nullable: true })
  justificationReason: string | null;

  @Column({
    enum: PricingProposalStatus,
    default: PricingProposalStatus.PENDING_MASTER_APPROVAL,
  })
  status: PricingProposalStatus;

  @Column({ name: 'requested_by_user_id', type: 'uuid', nullable: true })
  requestedByUserId: string | null;

  @Column({ name: 'reviewed_by_user_id', type: 'uuid', nullable: true })
  reviewedByUserId: string | null;

  @Column({ name: 'review_notes', type: 'text', nullable: true })
  reviewNotes: string | null;

  @CreateDateColumn({ name: 'requested_at' })
  requestedAt: Date;

  @Column({ type: 'varchar', name: 'reviewed_at', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Partner, (p) => p.pricingProposals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partner_id' })
  partner: Partner;

  @ManyToOne(() => Course, (c) => c.pricingProposals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course: Course;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'requested_by_user_id' })
  requestedBy: User | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewed_by_user_id' })
  reviewedBy: User | null;
}
