import { SupportService } from './support.service';
export declare class SupportController {
    private supportService;
    constructor(supportService: SupportService);
    getTickets(user: any): Promise<{
        replies: any;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        description: string;
        status: string;
        subject: string;
    }[]>;
    getTicketById(user: any, ticketId: string): Promise<{
        replies: any;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        description: string;
        status: string;
        subject: string;
    }>;
    createTicket(user: any, subject: string, description: string): Promise<{
        replies: any;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        description: string;
        status: string;
        subject: string;
    }>;
    addReply(user: any, ticketId: string, message: string): Promise<{
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
