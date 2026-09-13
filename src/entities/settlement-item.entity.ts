import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Settlement } from './settlement.entity';
import { PartnerPayable } from './partner-payable.entity';

@Entity('settlement_items')
@Unique(['settlementId', 'payableId'])
export class SettlementItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'settlement_id', type: 'uuid' })
  settlementId: string;

  @Column({ name: 'payable_id', type: 'uuid', unique: true })
  payableId: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Settlement, (s) => s.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'settlement_id' })
  settlement: Settlement;

  @OneToOne(() => PartnerPayable, (pp) => pp.settlementItem, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'payable_id' })
  payable: PartnerPayable;
}
