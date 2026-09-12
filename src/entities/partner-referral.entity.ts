import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Partner } from './partner.entity';
import { User } from './user.entity';
import { Enrollment } from './enrollment.entity';

export enum ReferralStatus {
  NEW = 'New',
  CONTACTED = 'Contacted',
  REGISTERED = 'Registered',
  CONVERTED = 'Converted',
  EXPIRED = 'Expired',
  UNDER_REVIEW = 'Under Review',
}

@Entity('partner_referrals')
export class PartnerReferral {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'partner_id', type: 'uuid' })
  partnerId: string;

  @Column({ type: 'varchar', name: 'full_name', length: 255 })
  fullName: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 50 })
  phone: string;

  @Column({
    type: 'varchar',
    name: 'course_interested',
    length: 255,
    nullable: true,
  })
  courseInterested: string | null;

  @Column({
    enum: ReferralStatus,
    default: ReferralStatus.NEW,
  })
  status: ReferralStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'referred_user_id', type: 'uuid', nullable: true })
  referredUserId: string | null;

  @CreateDateColumn({ name: 'referred_at' })
  referredAt: Date;

  @Column({ type: 'varchar', name: 'converted_at', nullable: true })
  convertedAt: Date | null;

  @Column({ type: 'varchar', name: 'expires_at' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Partner, (p) => p.referrals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partner_id' })
  partner: Partner;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'referred_user_id' })
  referredUser: User | null;

  @OneToMany(() => Enrollment, (e) => e.partnerReferral)
  enrollments: Enrollment[];
}
