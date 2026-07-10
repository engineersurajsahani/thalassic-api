"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
const supabase_js_1 = require("@supabase/supabase-js");
const path = require("path");
let DocumentsService = class DocumentsService {
    constructor(prisma) {
        this.prisma = prisma;
        this.supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL || 'https://expzlbadryzwvsxfmads.supabase.co', process.env.SUPABASE_KEY || 'sb_publishable_EXJSp2BD8TA2MvteYivQYg_X0ekYcaW');
    }
    async getUserDocuments(userId) {
        return this.prisma.document.findMany({
            where: { userId },
            orderBy: { uploadDate: 'desc' },
        });
    }
    async uploadDocument(userId, type, name, file, expiryDate) {
        const fileExtension = path.extname(file.originalname);
        const uniqueFilename = `${userId}-${type}-${Date.now()}${fileExtension}`;
        const bucketName = 'seafarer-documents';
        const { error: uploadError } = await this.supabase.storage
            .from(bucketName)
            .upload(uniqueFilename, file.buffer, {
            contentType: file.mimetype,
            upsert: true,
        });
        if (uploadError) {
            throw new Error(`Failed to upload file to Supabase storage: ${uploadError.message}`);
        }
        const { data: urlData } = this.supabase.storage
            .from(bucketName)
            .getPublicUrl(uniqueFilename);
        const fileUrl = urlData.publicUrl;
        const document = await this.prisma.document.create({
            data: {
                userId,
                type,
                name: file.originalname,
                url: fileUrl,
                status: 'pending',
                expiryDate: expiryDate || null,
            },
        });
        await this.prisma.notification.create({
            data: {
                userId,
                title: 'Document Uploaded',
                message: `Your ${type.toUpperCase()} document "${file.originalname}" has been uploaded and is pending verification.`,
            },
        });
        return document;
    }
    async deleteDocument(userId, docId) {
        const document = await this.prisma.document.findUnique({
            where: { id: docId },
        });
        if (!document || document.userId !== userId) {
            throw new common_1.NotFoundException('Document not found');
        }
        const filename = document.url.split('/').pop();
        const bucketName = 'seafarer-documents';
        if (filename) {
            const { error: deleteError } = await this.supabase.storage
                .from(bucketName)
                .remove([filename]);
            if (deleteError) {
                console.error('Failed to remove file from Supabase storage: ', deleteError.message);
            }
        }
        await this.prisma.document.delete({
            where: { id: docId },
        });
        return { message: 'Document deleted successfully' };
    }
};
exports.DocumentsService = DocumentsService;
exports.DocumentsService = DocumentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DocumentsService);
//# sourceMappingURL=documents.service.js.map