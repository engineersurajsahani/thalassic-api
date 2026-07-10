import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSecurityDto } from './dto/update-security.dto';
import { CreateSeaServiceDto } from './dto/create-sea-service.dto';
export declare class UsersController {
    private usersService;
    constructor(usersService: UsersService);
    updateProfile(user: any, dto: UpdateProfileDto): Promise<{
        message: string;
    }>;
    updateSecurity(user: any, dto: UpdateSecurityDto): Promise<{
        message: string;
    }>;
    addSeaService(user: any, dto: CreateSeaServiceDto): Promise<{
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
    deleteSeaService(user: any, recordId: string): Promise<{
        message: string;
    }>;
}
