import { MasterService } from './master.service';
export declare class MasterController {
    private readonly masterService;
    constructor(masterService: MasterService);
    getDashboard(): Promise<{
        seafarersCount: number;
        coursesCount: number;
        totalBookings: number;
        totalRevenue: string;
        ledger: {
            participant: any;
            course: any;
            revenue: any;
            status: any;
        }[] | undefined;
    }>;
    getReports(days?: string): Promise<{
        courses: {
            id: any;
            course: any;
            bookings: number;
            revenue: string;
            rating: string;
        }[];
        averageCompletion: string;
        refundRate: string;
    }>;
    getCourses(): Promise<any[]>;
    createCourse(dto: any): Promise<any>;
    updateCourse(id: string, dto: any): Promise<any>;
    deleteCourse(id: string): Promise<{
        success: boolean;
    }>;
    getUsers(role?: string): Promise<any[]>;
    createUser(dto: any): Promise<any>;
    getUserProfile(id: string): Promise<any>;
    updateUserStatus(id: string, status: string): Promise<{
        id: string;
        status: string;
        documents: any[] | null;
    }>;
    getSettings(): Promise<any>;
    updateSettings(dto: any): Promise<any>;
    updateProfile(req: any, dto: any): Promise<{
        id: any;
        name: any;
        email: any;
        role: any;
    } | {
        success: boolean;
    }>;
}
