"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
let DashboardService = class DashboardService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getDashboardData(userId) {
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
            throw new common_1.NotFoundException('User not found');
        }
        let score = 0;
        const totalWeights = 7;
        if (user.name)
            score++;
        if (user.phone)
            score++;
        if (user.profile?.dob)
            score++;
        if (user.profile?.nationality)
            score++;
        if (user.profile?.indosNumber)
            score++;
        if (user.profile?.address)
            score++;
        if ((user.profile?.seaService.length ?? 0) > 0 || user.documents.length > 0)
            score++;
        const completionPercentage = Math.round((score / totalWeights) * 100);
        const activeEnrollment = user.enrollments.find((e) => e.status === 'active');
        const completedCount = user.enrollments.filter((e) => e.status === 'completed').length;
        const certificates = {
            passport: user.documents.find((d) => d.type === 'passport')?.status || 'missing',
            cdc: user.documents.find((d) => d.type === 'cdc')?.status || 'missing',
            medical: user.documents.find((d) => d.type === 'medical')?.status || 'missing',
            stcw: user.documents.find((d) => d.type === 'stcw')?.status || 'missing',
        };
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
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map