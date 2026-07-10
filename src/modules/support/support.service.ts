import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  async getMyTickets(userId: string) {
    const tickets = await this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return tickets.map((t) => ({
      ...t,
      replies: JSON.parse(t.replies),
    }));
  }

  async getTicketById(userId: string, ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.userId !== userId) {
      throw new NotFoundException('Ticket not found');
    }

    return {
      ...ticket,
      replies: JSON.parse(ticket.replies),
    };
  }

  async createTicket(userId: string, subject: string, description: string) {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId,
        subject,
        description,
        status: 'open',
        replies: JSON.stringify([]),
      },
    });

    return {
      ...ticket,
      replies: JSON.parse(ticket.replies),
    };
  }

  async addReply(userId: string, ticketId: string, message: string, senderName: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.userId !== userId) {
      throw new NotFoundException('Ticket not found');
    }

    const currentReplies = JSON.parse(ticket.replies);
    const newReply = {
      sender: senderName,
      message,
      createdAt: new Date().toISOString(),
    };
    currentReplies.push(newReply);

    const updatedTicket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: 'open',
        replies: JSON.stringify(currentReplies),
      },
    });

    return {
      ...updatedTicket,
      replies: currentReplies,
    };
  }
}
