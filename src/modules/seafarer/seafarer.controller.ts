import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  UnauthorizedException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { SeafarerService } from './seafarer.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ROLES } from '../../common/decorators/roles.decorator';

@Controller()
@UseGuards(AuthGuard, RolesGuard)
@Roles(ROLES.SEAFARER, ROLES.MASTER)
export class SeafarerController {
  constructor(private seafarerService: SeafarerService) {}

  private uid(req: Request): string {
    const user = (req as any).user;
    if (!user?.id) throw new UnauthorizedException('User not authenticated');
    return user.id;
  }

  // ── Dashboard ──────────────────────────────
  @Get('dashboard')
  getDashboard(@Req() req: Request) {
    return this.seafarerService.getDashboard(this.uid(req));
  }

  // ── Notifications ──────────────────────────
  @Get('notifications')
  getNotifications(@Req() req: Request) {
    const user = (req as any).user;
    return this.seafarerService.getNotifications(user?.id, user?.role);
  }

  @Patch('notifications/:id/read')
  markRead(@Param('id') id: string) {
    return this.seafarerService.markNotificationRead(id);
  }

  @Post('notifications/read-all')
  markAllRead() {
    return this.seafarerService.markAllNotificationsRead();
  }

  // ── Courses ────────────────────────────────
  @Get('courses')
  getAllCourses() {
    return this.seafarerService.getAllCourses();
  }

  @Get('courses/my')
  getMyEnrollments(@Req() req: Request) {
    return this.seafarerService.getMyEnrollments(this.uid(req));
  }

  @Post('courses/:id/enroll')
  enrollInCourse(
    @Req() req: Request,
    @Param('id') courseId: string,
    @Body('referralCode') referralCode?: string,
    @Body('instituteId') instituteId?: string,
    @Body('instituteName') instituteName?: string,
    @Body('batchSchedule') batchSchedule?: string,
    @Body() body?: any,
  ) {
    return this.seafarerService.enrollInCourse(
      this.uid(req),
      courseId,
      referralCode || body?.referralCode,
      instituteId || body?.instituteId,
      instituteName || body?.instituteName,
      batchSchedule || body?.batchSchedule,
    );
  }

  @Put('courses/:id/progress')
  updateProgress(
    @Req() req: Request,
    @Param('id') courseId: string,
    @Body('progress') progress: number,
  ) {
    return this.seafarerService.updateCourseProgress(
      this.uid(req),
      courseId,
      progress,
    );
  }

  // ── Documents ──────────────────────────────
  @Get('documents')
  getDocuments(@Req() req: Request) {
    return this.seafarerService.getDocuments(this.uid(req));
  }

  @Post('documents/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @Req() req: Request,
    @Body('type') type: string,
    @Body('expiryDate') expiryDate: string,
    @Body() body: any,
    @UploadedFile() file: any,
  ) {
    return this.seafarerService.uploadDocument(
      this.uid(req),
      type || body?.type,
      expiryDate || body?.expiryDate,
      file,
      body,
    );
  }

  @Put('documents/:id')
  @UseInterceptors(FileInterceptor('file'))
  updateDocument(
    @Req() req: Request,
    @Param('id') docId: string,
    @Body() body: any,
    @UploadedFile() file?: any,
  ) {
    return this.seafarerService.updateDocument(
      this.uid(req),
      docId,
      body,
      file,
    );
  }

  @Get('documents/:id/download')
  downloadDocument(@Req() req: Request, @Param('id') docId: string) {
    const user = (req as any).user;
    return this.seafarerService.downloadDocument(
      this.uid(req),
      docId,
      user?.role,
    );
  }

  @Delete('documents/:id')
  deleteDocument(@Req() req: Request, @Param('id') docId: string) {
    return this.seafarerService.deleteDocument(this.uid(req), docId);
  }

  // ── User Profile ───────────────────────────
  @Get('users/profile')
  getUserProfile(@Req() req: Request) {
    return this.seafarerService.getUserProfile(this.uid(req));
  }

  @Post('users/profile/photo')
  @UseInterceptors(FileInterceptor('file'))
  uploadProfilePhoto(@Req() req: Request, @UploadedFile() file: any) {
    return this.seafarerService.uploadProfilePhoto(this.uid(req), file);
  }

  @Put('users/profile')
  updateUserProfile(@Req() req: Request, @Body() details: any) {
    return this.seafarerService.updateUserProfile(this.uid(req), details);
  }

  // ── Sea Service ────────────────────────────
  @Post('users/sea-service')
  addSeaService(@Req() req: Request, @Body() record: any) {
    return this.seafarerService.addSeaService(this.uid(req), record);
  }

  @Delete('users/sea-service/:id')
  deleteSeaService(@Param('id') id: string) {
    return this.seafarerService.deleteSeaService(id);
  }

  // ── Support ────────────────────────────────
  @Get('support')
  getTickets(@Req() req: Request) {
    return this.seafarerService.getTickets(this.uid(req));
  }

  @Get('support/:id')
  getTicketById(@Req() req: Request, @Param('id') id: string) {
    return this.seafarerService.getTicketById(this.uid(req), id);
  }

  @Post('support')
  createTicket(
    @Req() req: Request,
    @Body('subject') subject: string,
    @Body('description') description: string,
  ) {
    return this.seafarerService.createTicket(
      this.uid(req),
      subject,
      description,
    );
  }

  @Post('support/:id/reply')
  addReply(
    @Req() req: Request,
    @Param('id') ticketId: string,
    @Body('message') message: string,
  ) {
    return this.seafarerService.addReply(this.uid(req), ticketId, message);
  }

  // ── Referrals ──────────────────────────────
  @Get('referrals')
  getReferrals(@Req() req: Request) {
    return this.seafarerService.getReferrals(this.uid(req));
  }
}
