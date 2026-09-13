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

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  type: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'file_path', type: 'text' })
  filePath: string;

  @Column({ name: 'file_size', type: 'integer' })
  fileSize: number;

  @Column({ type: 'varchar', name: 'mime_type', length: 100 })
  mimeType: string;

  @Column({ type: 'varchar', length: 50, default: 'Pending' })
  status: string;

  @Column({
    type: 'varchar',
    name: 'document_number',
    length: 100,
    nullable: true,
  })
  documentNumber: string | null;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: string | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ name: 'verified_by', type: 'uuid', nullable: true })
  verifiedBy: string | null;

  @Column({ type: 'varchar', name: 'verified_at', nullable: true })
  verifiedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
