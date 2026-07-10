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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
const bcrypt = require("bcrypt");
let UsersService = class UsersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async updateProfile(userId, dto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true },
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                name: dto.name !== undefined ? dto.name : user.name,
                phone: dto.phone !== undefined ? dto.phone : user.phone,
            },
        });
        if (user.role === 'seafarer') {
            await this.prisma.seafarerProfile.upsert({
                where: { userId },
                create: {
                    userId,
                    dob: dto.dob || '',
                    nationality: dto.nationality || '',
                    indosNumber: dto.indosNumber || '',
                    address: dto.address || '',
                    profilePicture: dto.profilePicture || '',
                },
                update: {
                    dob: dto.dob !== undefined ? dto.dob : user.profile?.dob,
                    nationality: dto.nationality !== undefined ? dto.nationality : user.profile?.nationality,
                    indosNumber: dto.indosNumber !== undefined ? dto.indosNumber : user.profile?.indosNumber,
                    address: dto.address !== undefined ? dto.address : user.profile?.address,
                    profilePicture: dto.profilePicture !== undefined ? dto.profilePicture : user.profile?.profilePicture,
                },
            });
        }
        return { message: 'Profile updated successfully' };
    }
    async updateSecurity(userId, dto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
        if (!isMatch) {
            throw new common_1.BadRequestException('Incorrect current password');
        }
        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(dto.newPassword, salt);
        await this.prisma.user.update({
            where: { id: userId },
            data: { password: newPasswordHash },
        });
        return { message: 'Password updated successfully' };
    }
    async addSeaService(userId, dto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true },
        });
        if (!user || user.role !== 'seafarer' || !user.profile) {
            throw new common_1.NotFoundException('Seafarer profile not found');
        }
        const seaService = await this.prisma.seaServiceRecord.create({
            data: {
                profileId: user.profile.id,
                vesselName: dto.vesselName,
                imoNumber: dto.imoNumber,
                rank: dto.rank,
                signOn: dto.signOn,
                signOff: dto.signOff,
                company: dto.company,
            },
        });
        return seaService;
    }
    async deleteSeaService(userId, recordId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true },
        });
        if (!user || user.role !== 'seafarer' || !user.profile) {
            throw new common_1.NotFoundException('Seafarer profile not found');
        }
        const record = await this.prisma.seaServiceRecord.findUnique({
            where: { id: recordId },
        });
        if (!record || record.profileId !== user.profile.id) {
            throw new common_1.NotFoundException('Sea service record not found');
        }
        await this.prisma.seaServiceRecord.delete({
            where: { id: recordId },
        });
        return { message: 'Sea service record deleted successfully' };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map