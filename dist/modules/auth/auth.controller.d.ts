import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    login(loginDto: LoginDto): Promise<{
        token: string;
        user: {
            id: any;
            name: any;
            email: any;
            role: any;
            phone: any;
            onboardingStatus: any;
        };
    }>;
    register(registerDto: RegisterDto): Promise<{
        token: string;
        user: {
            id: `${string}-${string}-${string}-${string}-${string}`;
            name: string;
            email: string;
            role: string;
            phone: string | null;
        };
    }>;
    profile(req: Request): Promise<{
        id: any;
        name: any;
        email: any;
        role: any;
        phone: any;
        onboardingStatus: any;
    }>;
    logout(): {
        message: string;
    };
}
