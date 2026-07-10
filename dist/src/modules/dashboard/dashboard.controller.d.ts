import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private dashboardService;
    constructor(dashboardService: DashboardService);
    getDashboardData(user: any): Promise<{
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
