import { PrismaService } from '../../database/prisma.service';
export declare class SupportService {
    private prisma;
    constructor(prisma: PrismaService);
    getMyTickets(userId: string): Promise<{
        replies: any;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        description: string;
        status: string;
        subject: string;
    }[]>;
    getTicketById(userId: string, ticketId: string): Promise<{
        replies: any;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        description: string;
        status: string;
        subject: string;
    }>;
    createTicket(userId: string, subject: string, description: string): Promise<{
        replies: any;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        description: string;
        status: string;
        subject: string;
    }>;
    addReply(userId: string, ticketId: string, message: string, senderName: string): Promise<{
        replies: any;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        description: string;
        status: string;
        subject: string;
    }>;
}
