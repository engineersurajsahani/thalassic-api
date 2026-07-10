import { DocumentsService } from './documents.service';
export declare class DocumentsController {
    private documentsService;
    constructor(documentsService: DocumentsService);
    getDocuments(user: any): Promise<{
        id: string;
        name: string;
        userId: string;
        status: string;
        type: string;
        url: string;
        uploadDate: Date;
        expiryDate: string | null;
    }[]>;
    uploadDocument(user: any, file: Express.Multer.File, type: string, expiryDate?: string): Promise<{
        id: string;
        name: string;
        userId: string;
        status: string;
        type: string;
        url: string;
        uploadDate: Date;
        expiryDate: string | null;
    }>;
    deleteDocument(user: any, docId: string): Promise<{
        message: string;
    }>;
}
