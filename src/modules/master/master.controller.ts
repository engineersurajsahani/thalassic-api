import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MasterService } from './master.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, ROLES } from '../../common/decorators/roles.decorator';
import { UserStatus } from '../../entities';

@Controller('master')
@UseGuards(AuthGuard, RolesGuard)
@Roles(ROLES.MASTER)
export class MasterController {
  constructor(private readonly masterService: MasterService) {}

  @Get('dashboard/stats')
  getDashboardStats() {
    return this.masterService.getDashboardStats();
  }

  // --- Courses ---
  @Get('courses')
  getCourses() {
    return this.masterService.getCourses();
  }

  @Get('courses/:id')
  getCourseById(@Param('id') id: string) {
    return this.masterService.getCourseById(id);
  }

  @Post('courses')
  createCourse(@Body() data: any, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.masterService.createCourse(data, userId);
  }

  @Put('courses/:id')
  updateCourse(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.masterService.updateCourse(id, data, userId);
  }

  @Delete('courses/:id')
  deleteCourse(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.masterService.deleteCourse(id, userId);
  }

  // --- Institutes ---
  @Get('institutes')
  getInstitutes() {
    return this.masterService.getInstitutes();
  }

  @Post('institutes')
  createInstitute(@Body() data: any, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.masterService.createInstitute(data, userId);
  }

  // --- Seafarer Audits ---
  @Get('seafarers')
  getSeafarers() {
    return this.masterService.getSeafarers();
  }

  @Patch('seafarers/:id/audit')
  auditSeafarer(
    @Param('id') id: string,
    @Body('status') status: UserStatus,
    @Body('notes') notes: string,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.masterService.auditSeafarer(id, status, notes, userId);
  }

  @Patch('documents/:id/verify')
  verifyDocument(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('remarks') remarks: string,
    @Req() req: any,
  ) {
    const userId = req.user?.sub || req.user?.id;
    return this.masterService.verifyDocument(id, status, remarks, userId);
  }

  // --- Settings ---
  @Get('settings')
  getSettings() {
    return this.masterService.getSettings();
  }

  @Put('settings')
  updateSettings(@Body() data: any, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.masterService.updateSettings(data, userId);
  }
}
