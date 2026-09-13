import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('agent_metadata')
export class AgentMetadata {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'referral_code', nullable: true, unique: true })
  referralCode: string;

  @Column({ name: 'qr_code', type: 'text', nullable: true })
  qrCode: string;

  @Column({ name: 'onboarding_status', default: 'Invited' })
  onboardingStatus: string;

  @Column({ name: 'general_commission', type: 'decimal', precision: 5, scale: 2, default: 5.00 })
  generalCommission: number;

  @Column({ name: 'course_commissions', type: 'jsonb', default: {} })
  courseCommissions: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}
