import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('platform_settings')
export class PlatformSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    name: 'system_email',
    length: 255,
    default: 'support@hariomthalassic.com',
  })
  systemEmail: string;

  @Column({
    type: 'varchar',
    name: 'contact_phone',
    length: 50,
    default: '+91 22 12345678',
  })
  contactPhone: string;

  @Column({
    type: 'varchar',
    name: 'payment_gateway',
    length: 100,
    default: 'razorpay_production_mode',
  })
  paymentGateway: string;

  @Column({
    type: 'varchar',
    name: 'dgs_accreditation_id',
    length: 100,
    default: 'DGS-MTI-10294',
  })
  dgsAccreditationId: string;

  @Column({ type: 'varchar', length: 50, default: '27AABCH1234F1Z5' })
  gstin: string;

  @Column({ name: 'terms_and_conditions', type: 'text' })
  termsAndConditions: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
