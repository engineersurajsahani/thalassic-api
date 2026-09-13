import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';
import { Enrollment } from './enrollment.entity';
import { Commission } from './commission.entity';
import { Company } from './company.entity';

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invoice_number', nullable: true, unique: true })
  invoiceNumber: string;

  @Column({ name: 'invoice_type', nullable: true })
  invoiceType: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'purchase_id', type: 'uuid', nullable: true })
  purchaseId: string;

  @ManyToOne(() => Enrollment, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'purchase_id' })
  enrollment: Enrollment;

  @Column({ name: 'agent_id', type: 'uuid', nullable: true })
  agentId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'agent_id' })
  agent: User;

  @Column({ name: 'commission_snapshot_id', type: 'uuid', nullable: true })
  commissionSnapshotId: string;

  @ManyToOne(() => Commission, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'commission_snapshot_id' })
  commissionSnapshot: Commission;

  @Column({ name: 'customer_name', nullable: true })
  customerName: string;

  @Column({ name: 'customer_email', nullable: true })
  customerEmail: string;

  @Column({ name: 'customer_phone', nullable: true })
  customerPhone: string;

  @Column({ name: 'agent_name', nullable: true })
  agentName: string;

  @Column({ name: 'agent_referral_code', nullable: true })
  agentReferralCode: string;

  @Column({ name: 'course_name', nullable: true })
  courseName: string;

  @Column({ name: 'course_fee', type: 'decimal', precision: 10, scale: 2, nullable: true })
  courseFee: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.00 })
  discount: number;

  @Column({ name: 'final_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  finalAmount: number;

  @Column({ name: 'payment_gateway', default: 'razorpay' })
  paymentGateway: string;

  @Column({ name: 'transaction_id', nullable: true, unique: true })
  transactionId: string;

  @Column({ name: 'payment_method', default: 'Online UPI/Card' })
  paymentMethod: string;

  @Column({ name: 'payment_date', type: 'timestamp with time zone', nullable: true })
  paymentDate: Date;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ nullable: true })
  amount: string;

  @Column({ name: 'pdf_url', nullable: true })
  pdfUrl: string;

  @Column({ name: 'email_sent', default: false })
  emailSent: boolean;

  @Column({ default: 'Paid' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
