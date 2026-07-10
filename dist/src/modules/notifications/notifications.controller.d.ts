import { NotificationsService } from './notifications.service';
export declare class NotificationsController {
    private notificationsService;
    constructor(notificationsService: NotificationsService);
    getNotifications(user: any): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        title: string;
        message: string;
        isRead: boolean;
    }[]>;
    markAsRead(user: any, notificationId: string): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        title: string;
        message: string;
        isRead: boolean;
    }>;
    markAllAsRead(user: any): Promise<{
        message: string;
    }>;
}
