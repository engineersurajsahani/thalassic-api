import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getDashboardData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: {
            seaService: true,
          },
        },
        enrollments: {
          include: { course: true },
        },
        documents: true,
        notifications: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 1. Calculate Profile Completion Score
    let score = 0;
    const totalWeights = 7; // Name, Phone, DOB, Nationality, INDOS, Address, Sea Service / Document upload

    if (user.name) score++;
    if (user.phone) score++;
    if (user.profile?.dob) score++;
    if (user.profile?.nationality) score++;
    if (user.profile?.indosNumber) score++;
    if (user.profile?.address) score++;
    if ((user.profile?.seaService.length ?? 0) > 0 || user.documents.length > 0) score++;

    const completionPercentage = Math.round((score / totalWeights) * 100);

    // 2. Course Progress
    const activeEnrollment = user.enrollments.find((e) => e.status === 'active');
    const completedCount = user.enrollments.filter((e) => e.status === 'completed').length;

    // 3. Certificate Status Tracker
    const certificates = {
      passport: user.documents.find((d) => d.type === 'passport')?.status || 'missing',
      cdc: user.documents.find((d) => d.type === 'cdc')?.status || 'missing',
      medical: user.documents.find((d) => d.type === 'medical')?.status || 'missing',
      stcw: user.documents.find((d) => d.type === 'stcw')?.status || 'missing',
    };

    // 4. Notifications unread count
    const unreadNotificationsCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        profilePicture: user.profile?.profilePicture || '',
      },
      profileCompletion: completionPercentage,
      courses: {
        active: activeEnrollment
          ? {
              id: activeEnrollment.id,
              courseId: activeEnrollment.course.id,
              code: activeEnrollment.course.code,
              name: activeEnrollment.course.name,
              progress: activeEnrollment.progress,
            }
          : null,
        completedCount,
        totalEnrolled: user.enrollments.length,
      },
      certificates,
      notifications: user.notifications,
      unreadNotificationsCount,
    };
  }
}
