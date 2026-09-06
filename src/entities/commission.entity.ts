import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';
import { Enrollment } from './enrollment.entity';

@Entity('commissions')
export class Commission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'agent_id', type: 'uuid' })
  agentId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent: User;

  @Column({ name: 'purchase_id', type: 'uuid' })
  purchaseId: string;

  @ManyToOne(() => Enrollment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_id' })
  enrollment: Enrollment;

  @Column({ name: 'seafarer_name' })
  seafarerName: string;

  @Column({ name: 'course_name' })
  courseName: string;

  @Column({ name: 'course_fee', type: 'decimal', precision: 10, scale: 2 })
  courseFee: number;

  @Column({ name: 'commission_rate', type: 'decimal', precision: 5, scale: 2 })
  commissionRate: number;

  @Column({ name: 'commission_amount', type: 'decimal', precision: 10, scale: 2 })
  commissionAmount: number;

  @Column({ name: 'commission_source', default: 'General Commission' })
  commissionSource: string;

  @Column({ name: 'commission_version', default: 'v1.0' })
  commissionVersion: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ name: 'settlement_id', type: 'uuid', nullable: true })
  settlementId: string;

  @Column({ default: 'Pending' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @Column({ name: 'settled_at', type: 'timestamp with time zone', nullable: true })
  settledAt: Date;
}
