import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('settings')
export class PlatformSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'system_email', default: 'support@hariomthalassic.com' })
  systemEmail: string;

  @Column({ name: 'contact_phone', default: '+91 22 12345678' })
  contactPhone: string;

  @Column({ name: 'payment_gateway', default: 'razorpay_production_mode' })
  paymentGateway: string;

  @Column({ name: 'dgs_accreditation_id', default: 'DGS-MTI-10294' })
  dgsAccreditationId: string;
}
