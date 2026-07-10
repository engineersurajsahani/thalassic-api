import { PrismaService } from '../../database/prisma.service';
export declare class DocumentsService {
    private prisma;
    private supabase;
    constructor(prisma: PrismaService);
    getUserDocuments(userId: string): Promise<{
        id: string;
        name: string;
        userId: string;
        status: string;
        type: string;
        url: string;
        uploadDate: Date;
        expiryDate: string | null;
    }[]>;
    uploadDocument(userId: string, type: string, name: string, file: Express.Multer.File, expiryDate?: string): Promise<{
        id: string;
        name: string;
        userId: string;
        status: string;
        type: string;
        url: string;
        uploadDate: Date;
        expiryDate: string | null;
    }>;
    deleteDocument(userId: string, docId: string): Promise<{
        message: string;
    }>;
}
