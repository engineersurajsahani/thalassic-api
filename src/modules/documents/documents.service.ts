import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';

@Injectable()
export class DocumentsService {
  private supabase = createClient(
    process.env.SUPABASE_URL || 'https://expzlbadryzwvsxfmads.supabase.co',
    process.env.SUPABASE_KEY || 'sb_publishable_EXJSp2BD8TA2MvteYivQYg_X0ekYcaW'
  );

  constructor(private prisma: PrismaService) {}

  async getUserDocuments(userId: string) {
    return this.prisma.document.findMany({
      where: { userId },
      orderBy: { uploadDate: 'desc' },
    });
  }

  async uploadDocument(
    userId: string,
    type: string,
    name: string,
    file: Express.Multer.File,
    expiryDate?: string,
  ) {
    const fileExtension = path.extname(file.originalname);
    const uniqueFilename = `${userId}-${type}-${Date.now()}${fileExtension}`;
    const bucketName = 'seafarer-documents';

    // 1. Upload Multer file buffer directly to Supabase Storage
    const { error: uploadError } = await this.supabase.storage
      .from(bucketName)
      .upload(uniqueFilename, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload file to Supabase storage: ${uploadError.message}`);
    }

    // 2. Fetch the direct Public URL of the uploaded object
    const { data: urlData } = this.supabase.storage
      .from(bucketName)
      .getPublicUrl(uniqueFilename);

    const fileUrl = urlData.publicUrl;

    // 3. Write metadata to PostgreSQL database
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

    // 4. Create local alert notification
    await this.prisma.notification.create({
      data: {
        userId,
        title: 'Document Uploaded',
        message: `Your ${type.toUpperCase()} document "${file.originalname}" has been uploaded and is pending verification.`,
      },
    });

    return document;
  }

  async deleteDocument(userId: string, docId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: docId },
    });

    if (!document || document.userId !== userId) {
      throw new NotFoundException('Document not found');
    }

    // Extract filename from stored Supabase Storage public URL
    const filename = document.url.split('/').pop();
    const bucketName = 'seafarer-documents';

    // 1. Delete object from Supabase Storage
    if (filename) {
      const { error: deleteError } = await this.supabase.storage
        .from(bucketName)
        .remove([filename]);
      
      if (deleteError) {
        console.error('Failed to remove file from Supabase storage: ', deleteError.message);
      }
    }

    // 2. Delete metadata record from database
    await this.prisma.document.delete({
      where: { id: docId },
    });

    return { message: 'Document deleted successfully' };
  }
}
