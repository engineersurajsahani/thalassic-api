import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { CompanyAdmin } from './company-admin.entity';
import { CompanyCrew } from './company-crew.entity';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true, nullable: true })
  rpsl: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ name: 'contact_email', nullable: true })
  contactEmail: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @OneToMany(() => CompanyAdmin, admin => admin.company)
  admins: CompanyAdmin[];

  @OneToMany(() => CompanyCrew, crew => crew.company)
  crew: CompanyCrew[];
}
