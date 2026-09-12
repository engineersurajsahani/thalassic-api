import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Invoice } from './invoice.entity';
import { Enrollment } from './enrollment.entity';
import { User } from './user.entity';
import { Partner } from './partner.entity';
import { Company } from './company.entity';

export enum PaymentStatus {
  PENDING = 'Pending',
  SUCCESSFUL = 'Successful',
  FAILED = 'Failed',
  REFUNDED = 'Refunded',
}

export enum PaymentMethod {
  RAZORPAY = 'Razorpay',
  BANK_TRANSFER = 'Bank Transfer',
  CORPORATE_CREDIT = 'Corporate Credit',
  CASH_DEMAND_DRAFT = 'Cash/Demand Draft',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', name: 'payment_number', unique: true, length: 50 })
  paymentNumber: string;

  @Column({ name: 'invoice_id', type: 'uuid', nullable: true })
  invoiceId: string | null;

  @Column({ name: 'enrollment_id', type: 'uuid', nullable: true })
  enrollmentId: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'partner_id', type: 'uuid', nullable: true })
  partnerId: string | null;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: number;

  @Column({
    name: 'payment_method',

    enum: PaymentMethod,
    default: PaymentMethod.RAZORPAY,
  })
  paymentMethod: PaymentMethod;

  @Column({
    type: 'varchar',
    name: 'gateway_transaction_id',
    length: 255,
    nullable: true,
  })
  gatewayTransactionId: string | null;

  @Column({
    type: 'varchar',
    name: 'gateway_order_id',
    length: 255,
    nullable: true,
  })
  gatewayOrderId: string | null;

  @Column({
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({ type: 'varchar', name: 'paid_at', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ name: 'receipt_url', type: 'text', nullable: true })
  receiptUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Invoice, (i) => i.payments, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice | null;

  @ManyToOne(() => Enrollment, (e) => e.payments, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'enrollment_id' })
  enrollment: Enrollment | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @ManyToOne(() => Partner, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'partner_id' })
  partner: Partner | null;

  @ManyToOne(() => Company, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'company_id' })
  company: Company | null;
}
