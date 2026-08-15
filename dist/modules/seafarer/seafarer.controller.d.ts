import type { Request } from 'express';
import { SeafarerService } from './seafarer.service';
export declare class SeafarerController {
    private seafarerService;
    constructor(seafarerService: SeafarerService);
    private uid;
    getDashboard(req: Request): Promise<{
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
    getNotifications(req: Request): Promise<{
        id: string;
        title: string;
        message: string;
        isRead: boolean;
        read: boolean;
        createdAt: string;
    }[]>;
    markRead(id: string): Promise<{
        id: string;
        read: boolean;
    }>;
    markAllRead(): Promise<{
        success: boolean;
    }>;
    getAllCourses(): Promise<any[]>;
    getMyEnrollments(req: Request): Promise<{
        id: any;
        status: any;
        purchaseDate: any;
        course: any;
        courseId: any;
        progress: any;
    }[]>;
    enrollInCourse(req: Request, courseId: string, referralCode?: string): Promise<{
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
    updateProgress(req: Request, courseId: string, progress: number): Promise<{
        courseId: string;
        userId: string;
        progress: number;
        status: string;
        updated: boolean;
    }>;
    getDocuments(req: Request): Promise<{
        id: any;
        type: any;
        label: any;
        status: any;
        expiryDate: any;
        uploadedAt: any;
        url: any;
    }[]>;
    uploadDocument(req: Request, type: string, expiryDate: string, file: any): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        type: string;
        label: any;
        status: string;
        expiryDate: string | null;
        uploadedAt: string;
        message: string;
    }>;
    downloadDocument(req: Request, docId: string): Promise<{
        signedUrl: string;
        fileName: string;
    }>;
    deleteDocument(req: Request, docId: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    getUserProfile(req: Request): Promise<any>;
    updateUserProfile(req: Request, details: any): Promise<any>;
    addSeaService(req: Request, record: any): Promise<any>;
    deleteSeaService(id: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    getTickets(req: Request): Promise<any[]>;
    getTicketById(req: Request, id: string): Promise<any>;
    createTicket(req: Request, subject: string, description: string): Promise<{
        id: string;
        userId: string;
        subject: string;
        description: string;
        status: string;
        priority: string;
        createdAt: string;
        replies: never[];
    }>;
    addReply(req: Request, ticketId: string, message: string): Promise<{
        id: string;
        sender: string;
        message: string;
        timestamp: string;
    }>;
    getReferrals(req: Request): Promise<{
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
