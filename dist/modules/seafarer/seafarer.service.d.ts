import { SupabaseService } from '../supabase/supabase.service';
import { InvoicesService } from '../invoices/invoices.service';
export declare class SeafarerService {
    private supabaseService;
    private invoicesService;
    private usersFile;
    private seafarersFile;
    private coursesFile;
    private purchasesFile;
    private enrollmentsFile;
    constructor(supabaseService: SupabaseService, invoicesService: InvoicesService);
    private get db();
    private readJsonFile;
    private writeJsonFile;
    private getStandardCoursesList;
    getDashboard(userId: string): Promise<{
        profileCompletion: number;
        courses: {
            active: {
                name: any;
                code: any;
                progress: number;
            };
            completedCount: number;
        };
        certificates: {
            passport: string;
            cdc: string;
            medical: string;
            stcw: string;
        };
        notifications: never[];
    }>;
    getNotifications(userId: string, role?: string): Promise<{
        id: string;
        title: string;
        message: string;
        isRead: boolean;
        read: boolean;
        createdAt: string;
    }[]>;
    markNotificationRead(id: string): Promise<{
        id: string;
        read: boolean;
    }>;
    markAllNotificationsRead(): Promise<{
        success: boolean;
    }>;
    getAllCourses(): Promise<any[]>;
    getMyEnrollments(userId: string): Promise<{
        id: any;
        status: any;
        purchaseDate: any;
        course: any;
        courseId: any;
        progress: any;
    }[]>;
    enrollInCourse(userId: string, courseId: string, referralCode?: string): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        userId: string;
        courseId: any;
        course: {
            id: any;
            name: any;
            code: any;
            category: any;
            duration: any;
            fees: any;
            description: any;
        };
        status: string;
        progress: number;
        startDate: string;
        createdAt: string;
        updatedAt: string;
    }>;
    updateCourseProgress(userId: string, courseId: string, progress: number): Promise<{
        courseId: string;
        userId: string;
        progress: number;
        status: string;
        updated: boolean;
    }>;
    getDocuments(userId: string): Promise<{
        id: any;
        type: any;
        label: any;
        status: any;
        expiryDate: any;
        uploadedAt: any;
        url: any;
    }[]>;
    uploadDocument(userId: string, type: string, expiryDate?: string, file?: any): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        type: string;
        label: any;
        status: string;
        expiryDate: string | null;
        uploadedAt: string;
        message: string;
    }>;
    downloadDocument(userId: string, docId: string, role?: string): Promise<{
        signedUrl: string;
        fileName: string;
    }>;
    deleteDocument(userId: string, docId: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    getUserProfile(userId: string): Promise<any>;
    updateUserProfile(userId: string, details: any): Promise<any>;
    addSeaService(userId: string, record: any): Promise<any>;
    deleteSeaService(recordId: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    private inMemoryTickets;
    getTickets(userId: string): Promise<any[]>;
    getTicketById(userId: string, ticketId: string): Promise<any>;
    createTicket(userId: string, subject: string, description: string): Promise<{
        id: string;
        userId: string;
        subject: string;
        description: string;
        status: string;
        priority: string;
        createdAt: string;
        replies: never[];
    }>;
    addReply(userId: string, ticketId: string, message: string): Promise<{
        id: string;
        sender: string;
        message: string;
        timestamp: string;
    }>;
    getReferrals(userId: string): Promise<{
        referralCode: string;
        totalReferrals: number;
        successfulRegistrations: number;
        earnedCredits: number;
        history: {
            id: string;
            name: string;
            email: string;
            registrationDate: string;
            status: string;
            creditsEarned: number;
        }[];
    }>;
}
