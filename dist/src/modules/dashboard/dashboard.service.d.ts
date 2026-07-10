import { PrismaService } from '../../database/prisma.service';
export declare class DashboardService {
    private prisma;
    constructor(prisma: PrismaService);
    getDashboardData(userId: string): Promise<{
        user: {
            id: string;
            name: string;
            email: string;
            phone: string;
            profilePicture: string;
        };
        profileCompletion: number;
        courses: {
            active: {
                id: string;
                courseId: string;
                code: string;
                name: string;
                progress: number;
            };
            completedCount: number;
            totalEnrolled: number;
        };
        certificates: {
            passport: string;
            cdc: string;
            medical: string;
            stcw: string;
        };
        notifications: {
            id: string;
            createdAt: Date;
            userId: string;
            title: string;
            message: string;
            isRead: boolean;
        }[];
        unreadNotificationsCount: number;
    }>;
}
