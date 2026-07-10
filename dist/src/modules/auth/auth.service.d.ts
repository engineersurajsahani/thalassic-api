import { PrismaService } from '../../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthService {
    private prisma;
    private jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
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
    getProfile(userId: string): Promise<{
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
    private signToken;
}
