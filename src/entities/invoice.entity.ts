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
import { User } from './user.entity';
import { Partner } from './partner.entity';
import { Company } from './company.entity';
import { Enrollment } from './enrollment.entity';
import { Payment } from './payment.entity';

export enum InvoiceType {
  HOC = 'HOC',
  HAC = 'HAC',
  COMPANY = 'COMPANY',
}

export enum InvoiceStatus {
  ISSUED = 'Issued',
  PAID = 'Paid',
  PARTIALLY_PAID = 'Partially Paid',
  CANCELLED = 'Cancelled',
  REFUNDED = 'Refunded',
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', name: 'invoice_number', unique: true, length: 50 })
  invoiceNumber: string;

  @Column({
    name: 'invoice_type',

    enum: InvoiceType,
  })
  invoiceType: InvoiceType;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'partner_id', type: 'uuid', nullable: true })
  partnerId: string | null;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId: string | null;

  @Column({ name: 'enrollment_id', type: 'uuid', nullable: true })
  enrollmentId: string | null;

  @Column({ name: 'total_amount', type: 'numeric', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({
    name: 'tax_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0.0,
  })
  taxAmount: number;

  @Column({
    name: 'discount_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0.0,
  })
  discountAmount: number;

  @Column({ name: 'net_payable', type: 'numeric', precision: 10, scale: 2 })
  netPayable: number;

  @Column({
    enum: InvoiceStatus,
    default: InvoiceStatus.ISSUED,
  })
  status: InvoiceStatus;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ name: 'paid_date', type: 'date', nullable: true })
  paidDate: string | null;

  @Column({ name: 'pdf_url', type: 'text', nullable: true })
  pdfUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @ManyToOne(() => Partner, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'partner_id' })
  partner: Partner | null;

  @ManyToOne(() => Company, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'company_id' })
  company: Company | null;

  @ManyToOne(() => Enrollment, (e) => e.invoices, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'enrollment_id' })
  enrollment: Enrollment | null;

  @OneToMany(() => Payment, (p) => p.invoice)
  payments: Payment[];
}
