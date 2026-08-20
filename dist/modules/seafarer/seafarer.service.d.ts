import { SupabaseService } from '../supabase/supabase.service';
import { InvoicesService } from '../invoices/invoices.service';
export declare class SeafarerService {
    private supabaseService;
    private invoicesService;
    constructor(supabaseService: SupabaseService, invoicesService: InvoicesService);
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
    enrollInCourse(userId: string, courseId: string, referralCode?: string): Promise<any>;
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
        url: any;
        passportNumber: any;
        cdcNumber: any;
        placeOfIssue: any;
        issueDate: any;
        courseName: any;
        courseType: any;
        durationFrom: any;
        durationTo: any;
        metadata: any;
    }[]>;
    uploadDocument(userId: string, type: string, expiryDate?: string, file?: any, bodyMetadata?: any): Promise<any>;
    updateDocument(userId: string, docId: string, bodyMetadata: any, file?: any): Promise<any>;
    downloadDocument(userId: string, docId: string, role?: string): Promise<{
        signedUrl: string;
        fileName: any;
    }>;
    deleteDocument(userId: string, docId: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    getUserProfile(userId: string): Promise<{
        firstName: any;
        lastName: any;
        email: any;
        phone: any;
        profile: {
            firstName: any;
            lastName: any;
            email: any;
            phone: any;
            alternatePhone: any;
            dob: any;
            placeOfBirth: any;
            nationality: any;
            indosNumber: any;
            address: any;
            city: any;
            state: any;
            country: any;
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
        role?: any;
    }>;
    updateUserProfile(userId: string, details: any): Promise<{
        firstName: any;
        lastName: any;
        email: any;
        phone: any;
        profile: {
            firstName: any;
            lastName: any;
            email: any;
            phone: any;
            alternatePhone: any;
            dob: any;
            placeOfBirth: any;
            nationality: any;
            indosNumber: any;
            address: any;
            city: any;
            state: any;
            country: any;
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
        role?: any;
    }>;
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
