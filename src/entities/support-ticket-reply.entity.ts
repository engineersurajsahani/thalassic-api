import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SupportTicket } from './support-ticket.entity';
import { User } from './user.entity';

@Entity('support_ticket_replies')
export class SupportTicketReply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId: string;

  @Column({ name: 'sender_user_id', type: 'uuid' })
  senderUserId: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'attachment_url', type: 'text', nullable: true })
  attachmentUrl: string | null;

  @Column({ name: 'is_staff_reply', type: 'boolean', default: false })
  isStaffReply: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => SupportTicket, (t) => t.replies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: SupportTicket;

  @ManyToOne(() => User, (u) => u.supportReplies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_user_id' })
  sender: User;
}
