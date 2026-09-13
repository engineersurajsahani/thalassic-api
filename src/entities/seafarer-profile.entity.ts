import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('seafarer_profiles')
export class SeafarerProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @Column({ type: 'date', nullable: true })
  dob: string | null;

  @Column({ name: 'birth_place', type: 'varchar', length: 255, nullable: true })
  birthPlace: string | null;

  @Column({ name: 'father_name', type: 'varchar', length: 255, nullable: true })
  fatherName: string | null;

  @Column({
    name: 'passport_num',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  passportNum: string | null;

  @Column({ name: 'passport_issue', type: 'date', nullable: true })
  passportIssue: string | null;

  @Column({ name: 'passport_expiry', type: 'date', nullable: true })
  passportExpiry: string | null;

  @Column({
    name: 'passport_place',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  passportPlace: string | null;

  @Column({ name: 'indos_num', type: 'varchar', length: 100, nullable: true })
  indosNum: string | null;

  @Column({ name: 'indos_issue', type: 'date', nullable: true })
  indosIssue: string | null;

  @Column({
    name: 'indos_status',
    type: 'varchar',
    length: 50,
    default: 'Pending',
  })
  indosStatus: string;

  @Column({ name: 'cdc_num', type: 'varchar', length: 100, nullable: true })
  cdcNum: string | null;

  @Column({ name: 'cdc_issue', type: 'date', nullable: true })
  cdcIssue: string | null;

  @Column({ name: 'cdc_expiry', type: 'date', nullable: true })
  cdcExpiry: string | null;

  @Column({ name: 'cdc_place', type: 'varchar', length: 100, nullable: true })
  cdcPlace: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  education: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => User, (user) => user.profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
