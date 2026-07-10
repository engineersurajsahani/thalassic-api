import { CoursesService } from './courses.service';
export declare class CoursesController {
    private coursesService;
    constructor(coursesService: CoursesService);
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
    getMyEnrollments(user: any): Promise<({
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
    enrollInCourse(user: any, courseId: string): Promise<{
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
    updateProgress(user: any, courseId: string, progress: number): Promise<{
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
