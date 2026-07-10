import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  async getAllCourses() {
    return this.prisma.course.findMany();
  }

  async getCourseById(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    return course;
  }

  async getMyEnrollments(userId: string) {
    return this.prisma.enrollment.findMany({
      where: { userId },
      include: { course: true },
    });
  }

  async enrollInCourse(userId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const existing = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Already enrolled in this course');
    }

    const enrollment = await this.prisma.enrollment.create({
      data: {
        userId,
        courseId,
        status: 'active',
        progress: 0,
      },
      include: { course: true },
    });

    // Create a notification for successful enrollment
    await this.prisma.notification.create({
      data: {
        userId,
        title: 'Course Enrolled Successfully',
        message: `You have successfully enrolled in the course: ${course.name}.`,
      },
    });

    return enrollment;
  }

  async updateProgress(userId: string, courseId: string, progress: number) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    const isCompleted = progress >= 100;
    return this.prisma.enrollment.update({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
      data: {
        progress: Math.min(progress, 100),
        status: isCompleted ? 'completed' : 'active',
        completionDate: isCompleted ? new Date() : undefined,
      },
    });
  }
}
