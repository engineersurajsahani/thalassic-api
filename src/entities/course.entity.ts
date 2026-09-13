import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';
import { Enrollment } from './enrollment.entity';

@Entity('Course')
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  category: string;

  @Column({ nullable: true })
  duration: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  fees: number;

  @Column({ nullable: true })
  description: string;

  @Column({ default: 'Entry Level' })
  level: string;

  @Column({ nullable: true })
  icon: string;

  @Column({ nullable: true })
  image: string;

  @Column({ nullable: true })
  documentsRequired: string;

  @Column({ nullable: true })
  rating: string;

  @Column({ nullable: true })
  ratingCount: number;

  @OneToMany(() => Enrollment, enr => enr.course)
  enrollments: Enrollment[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
