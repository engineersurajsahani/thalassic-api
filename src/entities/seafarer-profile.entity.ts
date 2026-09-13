import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('SeafarerProfile')
export class SeafarerProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'userId', referencedColumnName: 'id' })
  user: User;

  @Column({ name: 'userId', type: 'uuid', unique: true })
  userId: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true })
  indosNumber: string;

  @Column({ nullable: true })
  nationality: string;

  @Column({ nullable: true })
  status: string;

  @Column({ nullable: true })
  dob: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  profilePicture: string;

  @Column({ nullable: true })
  updatedAt: string;
}
