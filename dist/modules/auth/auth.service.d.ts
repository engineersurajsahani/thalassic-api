import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
export declare class AuthService {
    private supabaseService;
    private jwtService;
    private configService;
    constructor(supabaseService: SupabaseService, jwtService: JwtService, configService: ConfigService);
    private readLocalUsers;
    private saveLocalUser;
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
    getProfile(token: string): Promise<{
        id: any;
        name: any;
        email: any;
        role: any;
        phone: any;
        onboardingStatus: any;
    }>;
}
