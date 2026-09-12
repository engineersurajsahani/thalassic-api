import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Partner } from './partner.entity';
import { Course } from './course.entity';

@Entity('partner_course_pricings')
@Unique(['partnerId', 'courseId'])
export class PartnerCoursePricing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'partner_id', type: 'uuid' })
  partnerId: string;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId: string;

  @Column({
    name: 'active_payable_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
  })
  activePayableAmount: number;

  @CreateDateColumn({ name: 'effective_date' })
  effectiveDate: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Partner, (p) => p.coursePricings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partner_id' })
  partner: Partner;

  @ManyToOne(() => Course, (c) => c.partnerPricings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course: Course;
}
