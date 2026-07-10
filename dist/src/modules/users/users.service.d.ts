import { PrismaService } from '../../database/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSecurityDto } from './dto/update-security.dto';
import { CreateSeaServiceDto } from './dto/create-sea-service.dto';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    updateProfile(userId: string, dto: UpdateProfileDto): Promise<{
        message: string;
    }>;
    updateSecurity(userId: string, dto: UpdateSecurityDto): Promise<{
        message: string;
    }>;
    addSeaService(userId: string, dto: CreateSeaServiceDto): Promise<{
        id: string;
        createdAt: Date;
        vesselName: string;
        imoNumber: string;
        rank: string;
        signOn: string;
        signOff: string;
        company: string;
        profileId: string;
    }>;
    deleteSeaService(userId: string, recordId: string): Promise<{
        message: string;
    }>;
}
