import { SupabaseService } from '../supabase/supabase.service';
export declare class MasterService {
    private supabaseService;
    private usersFile;
    private seafarersFile;
    private coursesFile;
    private purchasesFile;
    private settlementsFile;
    constructor(supabaseService: SupabaseService);
    private getSupabase;
    private readJsonFile;
    private writeJsonFile;
    private getStandardCoursesList;
    getDashboardData(): Promise<{
        seafarersCount: number;
        coursesCount: number;
        totalBookings: number;
        totalRevenue: string;
        ledger: any[] | undefined;
    }>;
    getReportsData(days?: string): Promise<{
        courses: {
            id: any;
            course: any;
            code: any;
            bookings: number;
            revenue: string;
            rating: string;
        }[];
        averageCompletion: string;
        refundRate: string;
    }>;
    getCourses(): Promise<any[]>;
    createCourse(dto: any): Promise<{
        id: string;
        code: any;
        name: any;
        category: any;
        duration: any;
        fees: any;
        standardFee: number;
        description: any;
        level: string;
        icon: string;
        image: string;
        documentsRequired: string;
        rating: string;
        ratingCount: number;
        status: string;
        trainingMode: string;
    }>;
    updateCourse(id: string, dto: any): Promise<any>;
    deleteCourse(id: string): Promise<{
        success: boolean;
    }>;
    getUsers(role?: string): Promise<any[]>;
    createUser(dto: any): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        name: any;
        email: any;
        plainPassword: any;
        password: string;
        phone: any;
        role: string;
        status: string;
        createdAt: string;
        updatedAt: string;
    }>;
    getUserProfile(userId: string): Promise<any>;
    updateUserStatus(id: string, status: string): Promise<{
        id: string;
        status: string;
    }>;
    getSettings(): Promise<{
        system_email: string;
        contact_phone: string;
        payment_gateway: string;
        dgs_accreditation_id: string;
    }>;
    updateSettings(dto: any): Promise<{
        system_email: any;
        contact_phone: any;
        payment_gateway: any;
        dgs_accreditation_id: any;
    }>;
    updateAdminProfile(adminId: string, dto: any): Promise<{
        success: boolean;
        user: any;
    }>;
}
