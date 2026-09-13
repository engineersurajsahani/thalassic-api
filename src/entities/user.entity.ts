import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Document } from './document.entity';
import { Enrollment } from './enrollment.entity';
import { SeafarerProfile } from './seafarer-profile.entity';

export enum UserRole {
  MASTER = 'MASTER',
  PARTNER_ADMIN = 'PARTNER_ADMIN',
  PARTNER = 'PARTNER',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  SEAFARER = 'SEAFARER',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  PENDING_AUDIT = 'Pending Audit',
  DEACTIVATED = 'DEACTIVATED',
}

@Entity('User')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'auth_user_id', nullable: true })
  authUserId: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  password: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: 'SEAFARER' })
  role: string;

  @Column({ default: 'Pending Audit' })
  status: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @OneToMany(() => Document, (doc) => doc.user)
  documents: Document[];

  @OneToMany(() => Enrollment, (enr) => enr.user)
  enrollments: Enrollment[];

  @OneToMany(() => SeafarerProfile, (profile) => profile.user)
  profile: SeafarerProfile;
}
