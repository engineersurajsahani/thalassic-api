import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { CompanyAdmin } from './company-admin.entity';
import { CompanySeafarer } from './company-seafarer.entity';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'varchar',
    name: 'registration_number',
    length: 100,
    nullable: true,
  })
  registrationNumber: string | null;

  @Column({ type: 'varchar', name: 'rpsl_number', length: 100, unique: true })
  rpslNumber: string;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 100, default: 'India' })
  country: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  website: string | null;

  @Column({ type: 'varchar', length: 50, default: 'Active' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => CompanyAdmin, (ca) => ca.company)
  companyAdmins: CompanyAdmin[];

  @OneToMany(() => CompanySeafarer, (cs) => cs.company)
  employedSeafarers: CompanySeafarer[];
}
