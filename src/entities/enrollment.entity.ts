import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { User } from './user.entity';
import { CourseInstitute } from './course-institute.entity';
import { Partner } from './partner.entity';
import { PartnerReferral } from './partner-referral.entity';
import { Invoice } from './invoice.entity';
import { Payment } from './payment.entity';
import { PartnerPayable } from './partner-payable.entity';

export enum EnrollmentStatus {
  PROCESSING = 'Processing',
  ACTIVE = 'Active',
  ON_HOLD = 'On Hold',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
}

@Entity('enrollments')
export class Enrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'course_institute_id', type: 'uuid' })
  courseInstituteId: string;

  @Column({ name: 'partner_id', type: 'uuid', nullable: true })
  partnerId: string | null;

  @Column({ name: 'partner_referral_id', type: 'uuid', nullable: true })
  partnerReferralId: string | null;

  @Column({ name: 'batch_start_date', type: 'date', nullable: true })
  batchStartDate: string | null;

  @Column({ name: 'batch_end_date', type: 'date', nullable: true })
  batchEndDate: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    enum: EnrollmentStatus,
    default: EnrollmentStatus.PROCESSING,
  })
  status: EnrollmentStatus;

  @Column({ name: 'progress_percent', type: 'integer', default: 0 })
  progressPercent: number;

  @Column({ name: 'completion_date', type: 'date', nullable: true })
  completionDate: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, (u) => u.enrollments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => CourseInstitute, (ci) => ci.enrollments, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'course_institute_id' })
  courseInstitute: CourseInstitute;

  @ManyToOne(() => Partner, (p) => p.enrollments, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'partner_id' })
  partner: Partner | null;

  @ManyToOne(() => PartnerReferral, (pr) => pr.enrollments, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'partner_referral_id' })
  partnerReferral: PartnerReferral | null;

  @OneToMany(() => Invoice, (inv) => inv.enrollment)
  invoices: Invoice[];

  @OneToMany(() => Payment, (pay) => pay.enrollment)
  payments: Payment[];

  @OneToOne(() => PartnerPayable, (pp) => pp.enrollment)
  partnerPayable: PartnerPayable;
}
