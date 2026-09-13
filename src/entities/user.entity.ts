import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Document } from './document.entity';
import { Enrollment } from './enrollment.entity';
import { SeafarerProfile } from './seafarer-profile.entity';

@Entity('User')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @OneToMany(() => Document, doc => doc.user)
  documents: Document[];

  @OneToMany(() => Enrollment, enr => enr.user)
  enrollments: Enrollment[];

  @OneToMany(() => SeafarerProfile, profile => profile.user)
  profile: SeafarerProfile;
}
