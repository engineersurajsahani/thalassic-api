import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Company } from './company.entity';
import { Partner } from './partner.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ type: 'varchar', name: 'actor_name', length: 255, nullable: true })
  actorName: string | null;

  @Column({ type: 'varchar', length: 255 })
  action: string;

  @Column({ type: 'varchar', length: 255 })
  module: string;

  @Column({
    type: 'varchar',
    name: 'entity_table',
    length: 100,
    nullable: true,
  })
  entityTable: string | null;

  @Column({ type: 'varchar', name: 'entity_id', length: 255, nullable: true })
  entityId: string | null;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId: string | null;

  @Column({ name: 'partner_id', type: 'uuid', nullable: true })
  partnerId: string | null;

  @Column({ type: 'text' })
  details: string;

  @Column({ name: 'previous_state', type: 'simple-json', nullable: true })
  previousState: any;

  @Column({ name: 'new_state', type: 'simple-json', nullable: true })
  newState: any;

  @Column({ type: 'varchar', name: 'ip_address', length: 50, nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, (u) => u.auditLogs, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'actor_user_id' })
  actor: User | null;

  @ManyToOne(() => Company, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'company_id' })
  company: Company | null;

  @ManyToOne(() => Partner, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'partner_id' })
  partner: Partner | null;
}
