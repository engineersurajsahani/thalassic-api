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

@Controller()
@UseGuards(AuthGuard)
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
  enrollInCourse(@Req() req: Request, @Param('id') courseId: string) {
    return this.seafarerService.enrollInCourse(this.uid(req), courseId);
  }

  @Put('courses/:id/progress')
  updateProgress(
    @Req() req: Request,
    @Param('id') courseId: string,
    @Body('progress') progress: number,
  ) {
    return this.seafarerService.updateCourseProgress(this.uid(req), courseId, progress);
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
    @UploadedFile() file: any,
  ) {
    return this.seafarerService.uploadDocument(this.uid(req), type, expiryDate);
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
    return this.seafarerService.createTicket(this.uid(req), subject, description);
  }

  @Post('support/:id/reply')
  addReply(
    @Req() req: Request,
    @Param('id') ticketId: string,
    @Body('message') message: string,
  ) {
    return this.seafarerService.addReply(this.uid(req), ticketId, message);
  }
}
