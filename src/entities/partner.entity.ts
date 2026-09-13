import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { PartnerAdmin } from './partner-admin.entity';
import { PartnerReferral } from './partner-referral.entity';
import { PartnerCoursePricing } from './partner-course-pricing.entity';
import { PartnerPricingProposal } from './partner-pricing-proposal.entity';
import { PartnerPayable } from './partner-payable.entity';
import { Settlement } from './settlement.entity';
import { Enrollment } from './enrollment.entity';

@Entity('partners')
export class Partner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', name: 'agency_name', length: 255 })
  agencyName: string;

  @Column({
    type: 'varchar',
    name: 'rpsl_license_number',
    length: 100,
    nullable: true,
  })
  rpslLicenseNumber: string | null;

  @Column({ type: 'varchar', name: 'contact_person', length: 255 })
  contactPerson: string;

  @Column({ type: 'varchar', name: 'contact_email', unique: true, length: 255 })
  contactEmail: string;

  @Column({ type: 'varchar', name: 'contact_phone', length: 50 })
  contactPhone: string;

  @Column({
    type: 'varchar',
    name: 'alternate_phone',
    length: 50,
    nullable: true,
  })
  alternatePhone: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 100, default: 'India' })
  country: string;

  @Column({ type: 'varchar', name: 'postal_code', length: 20, nullable: true })
  postalCode: string | null;

  @Column({ type: 'varchar', name: 'referral_code', unique: true, length: 50 })
  referralCode: string;

  @Column({ name: 'qr_code_url', type: 'text', nullable: true })
  qrCodeUrl: string | null;

  @Column({
    type: 'varchar',
    name: 'onboarding_status',
    length: 50,
    default: 'Active',
  })
  onboardingStatus: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => PartnerAdmin, (pa) => pa.partner)
  partnerAdmins: PartnerAdmin[];

  @OneToMany(() => PartnerReferral, (pr) => pr.partner)
  referrals: PartnerReferral[];

  @OneToMany(() => PartnerCoursePricing, (pcp) => pcp.partner)
  coursePricings: PartnerCoursePricing[];

  @OneToMany(() => PartnerPricingProposal, (ppp) => ppp.partner)
  pricingProposals: PartnerPricingProposal[];

  @OneToMany(() => PartnerPayable, (pp) => pp.partner)
  payables: PartnerPayable[];

  @OneToMany(() => Settlement, (s) => s.partner)
  settlements: Settlement[];

  @OneToMany(() => Enrollment, (e) => e.partner)
  enrollments: Enrollment[];
}
