import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { CourseInstitute } from './course-institute.entity';
import { PartnerCoursePricing } from './partner-course-pricing.entity';
import { PartnerPricingProposal } from './partner-pricing-proposal.entity';
import { PartnerPayable } from './partner-payable.entity';

export enum CourseStatus {
  ACTIVE = 'Active',
  DRAFT = 'Draft',
  ARCHIVED = 'Archived',
}

@Entity('courses')
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true, length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  category: string;

  @Column({ type: 'varchar', length: 50 })
  duration: string;

  @Column({ name: 'standard_fee', type: 'numeric', precision: 10, scale: 2 })
  standardFee: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    enum: CourseStatus,
    default: CourseStatus.ACTIVE,
  })
  status: CourseStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => CourseInstitute, (ci) => ci.course)
  instituteOfferings: CourseInstitute[];

  @OneToMany(() => PartnerCoursePricing, (pcp) => pcp.course)
  partnerPricings: PartnerCoursePricing[];

  @OneToMany(() => PartnerPricingProposal, (ppp) => ppp.course)
  pricingProposals: PartnerPricingProposal[];

  @OneToMany(() => PartnerPayable, (pp) => pp.course)
  partnerPayables: PartnerPayable[];
}
