import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SeafarerService } from './seafarer.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ROLES } from '../../common/decorators/roles.decorator';

@Controller('seafarer')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ROLES.SEAFARER, ROLES.MASTER)
export class SeafarerController {
  constructor(private readonly seafarerService: SeafarerService) {}

  @Get('dashboard')
  getDashboard(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.seafarerService.getDashboard(userId);
  }

  @Get('profile')
  getProfile(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.seafarerService.getProfile(userId);
  }

  @Put('profile')
  updateProfile(@Req() req: any, @Body() data: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.seafarerService.updateProfile(userId, data);
  }

  @Get('sea-service')
  getSeaService(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.seafarerService.getSeaService(userId);
  }

  @Post('sea-service')
  addSeaService(@Req() req: any, @Body() data: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.seafarerService.addSeaService(userId, data);
  }

  @Get('documents')
  getDocuments(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.seafarerService.getDocuments(userId);
  }

  @Post('documents')
  uploadDocument(@Req() req: any, @Body() data: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.seafarerService.uploadDocument(userId, data);
  }

  @Get('courses')
  getAvailableCourses() {
    return this.seafarerService.getAvailableCourses();
  }

  @Post('enroll')
  enrollCourse(@Req() req: any, @Body() data: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.seafarerService.enrollCourse(userId, data);
  }

  @Get('enrollments')
  getMyEnrollments(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.seafarerService.getMyEnrollments(userId);
  }

  @Get('invoices')
  getMyInvoices(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.seafarerService.getMyInvoices(userId);
  }

  @Get('support-tickets')
  getSupportTickets(@Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.seafarerService.getSupportTickets(userId);
  }

  @Post('support-tickets')
  createSupportTicket(@Req() req: any, @Body() data: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.seafarerService.createSupportTicket(userId, data);
  }
}
