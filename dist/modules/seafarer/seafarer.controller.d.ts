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
    getNotifications(req: Request): Promise<any[]>;
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
        status: string;
        purchaseDate: any;
        course: any;
        courseId: any;
        progress: any;
    }[]>;
    enrollInCourse(req: Request, courseId: string, referralCode?: string): Promise<any>;
    updateProgress(req: Request, courseId: string, progress: number): Promise<{
        courseId: string;
        userId: string;
        progress: number;
        updated: boolean;
        data: any[];
    }>;
    getDocuments(req: Request): Promise<{
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
    uploadDocument(req: Request, type: string, expiryDate: string, body: any, file: any): Promise<any>;
    updateDocument(req: Request, docId: string, body: any, file?: any): Promise<any>;
    downloadDocument(req: Request, docId: string): Promise<{
        signedUrl: string;
        fileName: any;
    }>;
    deleteDocument(req: Request, docId: string): Promise<{
        id: string;
        deleted: boolean;
    }>;
    getUserProfile(req: Request): Promise<{
        onboardingStatus: any;
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
    updateUserProfile(req: Request, details: any): Promise<{
        onboardingStatus: any;
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
