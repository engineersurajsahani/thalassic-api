import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('partner_applications')
export class PartnerApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_name' })
  companyName: string;

  @Column({ name: 'contact_person' })
  contactPerson: string;

  @Column()
  email: string;

  @Column()
  phone: string;

  @Column({ name: 'company_type', nullable: true })
  companyType: string;

  @Column({ name: 'fleet_size', nullable: true })
  fleetSize: string;

  @Column({ default: 'Pending' })
  status: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
