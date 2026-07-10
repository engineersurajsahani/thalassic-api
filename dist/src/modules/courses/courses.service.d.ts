import { PrismaService } from '../../database/prisma.service';
export declare class CoursesService {
    private prisma;
    constructor(prisma: PrismaService);
    getAllCourses(): Promise<{
        id: string;
        name: string;
        code: string;
        description: string;
        duration: string;
        level: string;
        icon: string;
        category: string;
        image: string;
        fees: string;
        documentsRequired: string;
        rating: number;
        ratingCount: number;
    }[]>;
    getCourseById(id: string): Promise<{
        id: string;
        name: string;
        code: string;
        description: string;
        duration: string;
        level: string;
        icon: string;
        category: string;
        image: string;
        fees: string;
        documentsRequired: string;
        rating: number;
        ratingCount: number;
    }>;
    getMyEnrollments(userId: string): Promise<({
        course: {
            id: string;
            name: string;
            code: string;
            description: string;
            duration: string;
            level: string;
            icon: string;
            category: string;
            image: string;
            fees: string;
            documentsRequired: string;
            rating: number;
            ratingCount: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        courseId: string;
        status: string;
        progress: number;
        startDate: Date;
        completionDate: Date | null;
    })[]>;
    enrollInCourse(userId: string, courseId: string): Promise<{
        course: {
            id: string;
            name: string;
            code: string;
            description: string;
            duration: string;
            level: string;
            icon: string;
            category: string;
            image: string;
            fees: string;
            documentsRequired: string;
            rating: number;
            ratingCount: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        courseId: string;
        status: string;
        progress: number;
        startDate: Date;
        completionDate: Date | null;
    }>;
    updateProgress(userId: string, courseId: string, progress: number): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        courseId: string;
        status: string;
        progress: number;
        startDate: Date;
        completionDate: Date | null;
    }>;
}
