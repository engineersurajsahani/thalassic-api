import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Commission } from './commission.entity';
import { User } from './user.entity';

@Entity('commission_status_history')
export class CommissionStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'commission_id', type: 'uuid' })
  commissionId: string;

  @ManyToOne(() => Commission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'commission_id' })
  commission: Commission;

  @Column({ name: 'old_status' })
  oldStatus: string;

  @Column({ name: 'new_status' })
  newStatus: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ name: 'changed_by_user_id', type: 'uuid', nullable: true })
  changedByUserId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'changed_by_user_id' })
  changedByUser: User;

  @Column({ name: 'changed_by_user_name', nullable: true })
  changedByUserName: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
