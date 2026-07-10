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
exports.CoursesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
let CoursesService = class CoursesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAllCourses() {
        return this.prisma.course.findMany();
    }
    async getCourseById(id) {
        const course = await this.prisma.course.findUnique({
            where: { id },
        });
        if (!course) {
            throw new common_1.NotFoundException('Course not found');
        }
        return course;
    }
    async getMyEnrollments(userId) {
        return this.prisma.enrollment.findMany({
            where: { userId },
            include: { course: true },
        });
    }
    async enrollInCourse(userId, courseId) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
        });
        if (!course) {
            throw new common_1.NotFoundException('Course not found');
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
            throw new common_1.ConflictException('Already enrolled in this course');
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
        await this.prisma.notification.create({
            data: {
                userId,
                title: 'Course Enrolled Successfully',
                message: `You have successfully enrolled in the course: ${course.name}.`,
            },
        });
        return enrollment;
    }
    async updateProgress(userId, courseId, progress) {
        const enrollment = await this.prisma.enrollment.findUnique({
            where: {
                userId_courseId: {
                    userId,
                    courseId,
                },
            },
        });
        if (!enrollment) {
            throw new common_1.NotFoundException('Enrollment not found');
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
};
exports.CoursesService = CoursesService;
exports.CoursesService = CoursesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CoursesService);
//# sourceMappingURL=courses.service.js.map