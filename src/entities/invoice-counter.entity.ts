import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('invoice_counters')
export class InvoiceCounter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', name: 'year_month', unique: true, length: 4 })
  yearMonth: string;

  @Column({ name: 'hoc_counter', type: 'integer', default: 0 })
  hocCounter: number;

  @Column({ name: 'hac_counter', type: 'integer', default: 0 })
  hacCounter: number;

  @Column({ name: 'company_counter', type: 'integer', default: 0 })
  companyCounter: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
