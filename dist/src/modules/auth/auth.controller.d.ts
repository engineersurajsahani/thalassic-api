import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    register(dto: RegisterDto): Promise<{
        token: string;
        user: {
            id: string;
            email: string;
            name: string;
            phone: string;
            role: string;
        };
    }>;
    login(dto: LoginDto): Promise<{
        token: string;
        user: {
            id: string;
            email: string;
            name: string;
            phone: string;
            role: string;
        };
    }>;
    getProfile(user: any): Promise<{
        id: string;
        email: string;
        name: string;
        phone: string;
        role: string;
        profile: {
            seaService: {
                id: string;
                createdAt: Date;
                vesselName: string;
                imoNumber: string;
                rank: string;
                signOn: string;
                signOff: string;
                company: string;
                profileId: string;
            }[];
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            dob: string | null;
            nationality: string | null;
            indosNumber: string | null;
            address: string | null;
            profilePicture: string | null;
            userId: string;
        };
    }>;
    logout(): Promise<{
        message: string;
    }>;
}
