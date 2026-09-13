import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';
import { Course } from './course.entity';

@Entity('Enrollment')
export class Enrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, user => user.enrollments)
  @JoinColumn({ name: 'userId', referencedColumnName: 'id' })
  user: User;

  @Column({ name: 'userId', type: 'uuid' })
  userId: string;

  @ManyToOne(() => Course, course => course.enrollments)
  @JoinColumn({ name: 'courseId', referencedColumnName: 'id' })
  course: Course;

  @Column({ name: 'courseId', type: 'uuid' })
  courseId: string;

  @Column({ default: 'ACTIVE' })
  status: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  progress: number;

  @Column({ nullable: true })
  instituteId: string;

  @Column({ nullable: true })
  instituteName: string;

  @Column({ nullable: true })
  batchSchedule: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
