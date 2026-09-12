import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('sea_service_records')
export class SeaServiceRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', name: 'rpsl_company', length: 255 })
  rpslCompany: string;

  @Column({ type: 'varchar', name: 'vessel_name', length: 255 })
  vesselName: string;

  @Column({ type: 'varchar', name: 'vessel_type', length: 100 })
  vesselType: string;

  @Column({ type: 'varchar', name: 'imo_number', length: 50, nullable: true })
  imoNumber: string | null;

  @Column({ type: 'varchar', length: 100 })
  rank: string;

  @Column({ name: 'sign_on_date', type: 'date' })
  signOnDate: string;

  @Column({ name: 'sign_off_date', type: 'date', nullable: true })
  signOffDate: string | null;

  @Column({ name: 'duration_days', type: 'integer', nullable: true })
  durationDays: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.seaServiceRecords, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
