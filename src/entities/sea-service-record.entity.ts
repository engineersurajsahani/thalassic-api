import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('sea_service_records')
export class SeaServiceRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  rpsl: string;

  @Column()
  vessel: string;

  @Column({ name: 'vessel_type', nullable: true })
  vesselType: string;

  @Column({ nullable: true })
  imo: string;

  @Column()
  rank: string;

  @Column({ name: 'sign_on', type: 'date' })
  signOn: string;

  @Column({ name: 'sign_off', type: 'date', nullable: true })
  signOff: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;
}
