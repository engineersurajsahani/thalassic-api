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
import { SettlementItem } from './settlement-item.entity';

export enum SettlementStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  PAID = 'Paid',
  CANCELLED = 'Cancelled',
}

@Entity('settlements')
export class Settlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    name: 'settlement_number',
    unique: true,
    length: 50,
  })
  settlementNumber: string;

  @Column({ name: 'partner_id', type: 'uuid' })
  partnerId: string;

  @Column({ name: 'total_amount', type: 'numeric', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ name: 'total_items', type: 'integer', default: 1 })
  totalItems: number;

  @Column({
    enum: SettlementStatus,
    default: SettlementStatus.PENDING,
  })
  status: SettlementStatus;

  @Column({
    type: 'varchar',
    name: 'payment_reference',
    length: 100,
    nullable: true,
  })
  paymentReference: string | null;

  @Column({ name: 'processed_by_user_id', type: 'uuid', nullable: true })
  processedByUserId: string | null;

  @Column({ type: 'varchar', name: 'processed_at', nullable: true })
  processedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Partner, (p) => p.settlements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partner_id' })
  partner: Partner;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'processed_by_user_id' })
  processedByUser: User | null;

  @OneToMany(() => SettlementItem, (si) => si.settlement)
  items: SettlementItem[];
}
