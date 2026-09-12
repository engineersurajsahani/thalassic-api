import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { CourseInstitute } from './course-institute.entity';

@Entity('institutes')
export class Institute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', unique: true, length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 100 })
  state: string;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'varchar', name: 'accreditation_id', length: 100 })
  accreditationId: string;

  @Column({
    type: 'varchar',
    name: 'contact_email',
    length: 255,
    nullable: true,
  })
  contactEmail: string | null;

  @Column({
    type: 'varchar',
    name: 'contact_phone',
    length: 50,
    nullable: true,
  })
  contactPhone: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => CourseInstitute, (ci) => ci.institute)
  courseOfferings: CourseInstitute[];
}
