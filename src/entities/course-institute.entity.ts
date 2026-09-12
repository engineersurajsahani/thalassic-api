import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Unique,
} from 'typeorm';
import { Course } from './course.entity';
import { Institute } from './institute.entity';
import { Enrollment } from './enrollment.entity';

@Entity('course_institutes')
@Unique(['courseId', 'instituteId'])
export class CourseInstitute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId: string;

  @Column({ name: 'institute_id', type: 'uuid' })
  instituteId: string;

  @Column({
    type: 'varchar',
    name: 'batch_frequency',
    length: 100,
    default: 'Weekly',
  })
  batchFrequency: string;

  @Column({ type: 'integer', default: 24 })
  capacity: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Course, (c) => c.instituteOfferings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course: Course;

  @ManyToOne(() => Institute, (i) => i.courseOfferings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'institute_id' })
  institute: Institute;

  @OneToMany(() => Enrollment, (e) => e.courseInstitute)
  enrollments: Enrollment[];
}
