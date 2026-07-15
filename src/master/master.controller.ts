import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { MasterService } from './master.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('master')
@UseGuards(AuthGuard)
export class MasterController {
  constructor(private readonly masterService: MasterService) {}

  // --- 1. Dashboard API ---
  @Get('dashboard')
  getDashboard() {
    return this.masterService.getDashboardData();
  }

  @Get('reports')
  getReports() {
    return this.masterService.getReportsData();
  }

  // --- 2. Course Management APIs ---
  @Get('courses')
  getCourses() {
    return this.masterService.getCourses();
  }

  @Post('courses')
  createCourse(@Body() dto: any) {
    return this.masterService.createCourse(dto);
  }

  @Patch('courses/:id')
  updateCourse(@Param('id') id: string, @Body() dto: any) {
    return this.masterService.updateCourse(id, dto);
  }

  @Delete('courses/:id')
  deleteCourse(@Param('id') id: string) {
    return this.masterService.deleteCourse(id);
  }

  // --- 3. User Management APIs ---
  @Get('users')
  getUsers(@Query('role') role?: string) {
    return this.masterService.getUsers(role);
  }

  @Post('users')
  createUser(@Body() dto: any) {
    return this.masterService.createUser(dto);
  }

  @Get('users/:id/profile')
  getUserProfile(@Param('id') id: string) {
    return this.masterService.getUserProfile(id);
  }

  @Patch('users/:id/status')
  updateUserStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.masterService.updateUserStatus(id, status);
  }

  // --- 4. Settings APIs ---
  @Get('settings')
  getSettings() {
    return this.masterService.getSettings();
  }

  @Patch('settings')
  updateSettings(@Body() dto: any) {
    return this.masterService.updateSettings(dto);
  }
}
