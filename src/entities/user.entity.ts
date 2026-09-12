import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { SeafarerProfile } from './seafarer-profile.entity';
import { SeaServiceRecord } from './sea-service-record.entity';
import { Document } from './document.entity';
import { Enrollment } from './enrollment.entity';
import { PartnerAdmin } from './partner-admin.entity';
import { CompanyAdmin } from './company-admin.entity';
import { CompanySeafarer } from './company-seafarer.entity';
import { SupportTicket } from './support-ticket.entity';
import { SupportTicketReply } from './support-ticket-reply.entity';
import { Notification } from './notification.entity';
import { AuditLog } from './audit-log.entity';

export enum UserRole {
  MASTER = 'MASTER',
  PARTNER_ADMIN = 'PARTNER_ADMIN',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  SEAFARER = 'SEAFARER',
}

export enum UserStatus {
  ACTIVE = 'Active',
  PENDING_AUDIT = 'Pending Audit',
  ON_HOLD = 'On Hold',
  DEACTIVATED = 'Deactivated',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'auth_user_id', type: 'uuid', unique: true, nullable: true })
  authUserId: string | null;

  @Column({ type: 'varchar', unique: true, length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({
    enum: UserRole,
    default: UserRole.SEAFARER,
  })
  role: UserRole;

  @Column({
    enum: UserStatus,
    default: UserStatus.PENDING_AUDIT,
  })
  status: UserStatus;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => SeafarerProfile, (profile) => profile.user)
  profile: SeafarerProfile;

  @OneToMany(() => SeaServiceRecord, (record) => record.user)
  seaServiceRecords: SeaServiceRecord[];

  @OneToMany(() => Document, (doc) => doc.user)
  documents: Document[];

  @OneToMany(() => Enrollment, (enrollment) => enrollment.user)
  enrollments: Enrollment[];

  @OneToMany(() => PartnerAdmin, (pa) => pa.user)
  partnerAdmins: PartnerAdmin[];

  @OneToMany(() => CompanyAdmin, (ca) => ca.user)
  companyAdmins: CompanyAdmin[];

  @OneToMany(() => CompanySeafarer, (cs) => cs.user)
  companyEmployments: CompanySeafarer[];

  @OneToMany(() => SupportTicket, (ticket) => ticket.user)
  supportTickets: SupportTicket[];

  @OneToMany(() => SupportTicketReply, (reply) => reply.sender)
  supportReplies: SupportTicketReply[];

  @OneToMany(() => Notification, (n) => n.user)
  notifications: Notification[];

  @OneToMany(() => AuditLog, (log) => log.actor)
  auditLogs: AuditLog[];
}
