import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('Document')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, user => user.documents)
  @JoinColumn({ name: 'userId', referencedColumnName: 'id' })
  user: User;

  @Column({ name: 'userId', type: 'uuid' })
  userId: string;

  @Column()
  type: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  url: string;

  @Column({ nullable: true })
  expiryDate: string;

  @Column({ nullable: true })
  documentNumber: string;

  @Column({ nullable: true })
  placeOfIssue: string;

  @Column({ nullable: true })
  dateOfIssue: string;

  @Column({ default: 'Pending' })
  status: string;

  @Column({ nullable: true })
  remarks: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
