import { PrismaService } from '../../database/prisma.service';
export declare class NotificationsService {
    private prisma;
    constructor(prisma: PrismaService);
    getNotifications(userId: string): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        title: string;
        message: string;
        isRead: boolean;
    }[]>;
    markAsRead(userId: string, notificationId: string): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        title: string;
        message: string;
        isRead: boolean;
    }>;
    markAllAsRead(userId: string): Promise<{
        message: string;
    }>;
}
