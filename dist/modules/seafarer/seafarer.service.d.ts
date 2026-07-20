import { SupabaseService } from '../supabase/supabase.service';
export declare class SeafarerService {
    private supabaseService;
    constructor(supabaseService: SupabaseService);
    private get db();
    getDashboard(userId: string): Promise<{
        profileCompletion: number;
        courses: {
            active: {
                name: any;
                code: any;
                progress: number;
            } | null;
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
    getNotifications(userId: string, role?: string): Promise<any[]>;
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
        status: string;
        purchaseDate: any;
        course: any;
        courseId: any;
        progress: any;
    }[]>;
    enrollInCourse(userId: string, courseId: string): Promise<any>;
    updateCourseProgress(userId: string, courseId: string, progress: number): Promise<{
        courseId: string;
        userId: string;
        progress: number;
        updated: boolean;
        data: any[];
    }>;
    getDocuments(userId: string): Promise<{
        id: any;
        type: any;
        label: any;
        status: any;
        expiryDate: any;
        uploadedAt: any;
    }[]>;
    uploadDocument(userId: string, type: string, expiryDate?: string, fileName?: string): Promise<any>;
    deleteDocument(userId: string, docId: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    getUserProfile(userId: string): Promise<{
        profile: {
            dob: any;
            birthPlace: any;
            nationality: any;
            indosNumber: any;
            address: any;
            profilePicture: any;
            seaService: {
                id: any;
                rpsl: any;
                vessel: any;
                vesselType: any;
                imo: any;
                rank: any;
                signOn: any;
                signOff: any;
            }[];
        };
        id?: any;
        name?: any;
        email?: any;
        phone?: any;
        role?: any;
    }>;
    updateUserProfile(userId: string, details: any): Promise<{
        profile: {
            dob: any;
            birthPlace: any;
            nationality: any;
            indosNumber: any;
            address: any;
            profilePicture: any;
            seaService: {
                id: any;
                rpsl: any;
                vessel: any;
                vesselType: any;
                imo: any;
                rank: any;
                signOn: any;
                signOff: any;
            }[];
        };
        id?: any;
        name?: any;
        email?: any;
        phone?: any;
        role?: any;
    }>;
    addSeaService(userId: string, record: any): Promise<any>;
    deleteSeaService(recordId: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    getTickets(userId: string): Promise<never[]>;
    getTicketById(userId: string, ticketId: string): Promise<null>;
    createTicket(userId: string, subject: string, description: string): Promise<{
        id: string;
        userId: string;
        subject: string;
        description: string;
        status: string;
        createdAt: string;
    }>;
    addReply(userId: string, ticketId: string, message: string): Promise<{
        ticketId: string;
        message: string;
        from: string;
        createdAt: string;
    }>;
}
