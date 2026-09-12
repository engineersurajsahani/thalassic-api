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
import { Company } from './company.entity';
import { User } from './user.entity';

@Entity('company_seafarers')
@Unique(['companyId', 'userId'])
export class CompanySeafarer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', name: 'employee_id', length: 100, nullable: true })
  employeeId: string | null;

  @Column({ type: 'varchar', name: 'designation_rank', length: 100 })
  designationRank: string;

  @Column({ type: 'varchar', length: 50, default: 'Employed' })
  status: string;

  @Column({ name: 'joined_at', type: 'date', nullable: true })
  joinedAt: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Company, (c) => c.employedSeafarers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => User, (u) => u.companyEmployments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
