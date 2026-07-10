import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('courses')
export class CoursesController {
  constructor(private coursesService: CoursesService) {}

  @Public()
  @Get()
  async getAllCourses() {
    return this.coursesService.getAllCourses();
  }

  @Get('my')
  async getMyEnrollments(@CurrentUser() user: any) {
    return this.coursesService.getMyEnrollments(user.sub);
  }

  @Public()
  @Get(':id')
  async getCourseById(@Param('id') id: string) {
    return this.coursesService.getCourseById(id);
  }

  @Post(':id/enroll')
  @HttpCode(HttpStatus.CREATED)
  async enrollInCourse(@CurrentUser() user: any, @Param('id') courseId: string) {
    return this.coursesService.enrollInCourse(user.sub, courseId);
  }

  @Put(':id/progress')
  @HttpCode(HttpStatus.OK)
  async updateProgress(
    @CurrentUser() user: any,
    @Param('id') courseId: string,
    @Body('progress') progress: number,
  ) {
    return this.coursesService.updateProgress(user.sub, courseId, progress);
  }
}
