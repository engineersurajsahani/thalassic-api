import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('documents')
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  @Get()
  async getDocuments(@CurrentUser() user: any) {
    return this.documentsService.getUserDocuments(user.sub);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async uploadDocument(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: string,
    @Body('expiryDate') expiryDate?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!type) {
      throw new BadRequestException('Document type is required');
    }
    return this.documentsService.uploadDocument(
      user.sub,
      type,
      file.originalname,
      file,
      expiryDate,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteDocument(@CurrentUser() user: any, @Param('id') docId: string) {
    return this.documentsService.deleteDocument(user.sub, docId);
  }
}
