import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcrypt';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSecurityDto } from './dto/update-security.dto';
import { CreateSeaServiceDto } from './dto/create-sea-service.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update User Name and Phone
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name !== undefined ? dto.name : user.name,
        phone: dto.phone !== undefined ? dto.phone : user.phone,
      },
    });

    // Update SeafarerProfile (or create if somehow missing)
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

  async updateSecurity(userId: string, dto: UpdateSecurityDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Incorrect current password');
    }

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(dto.newPassword, salt);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: newPasswordHash },
    });

    return { message: 'Password updated successfully' };
  }

  async addSeaService(userId: string, dto: CreateSeaServiceDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user || user.role !== 'seafarer' || !user.profile) {
      throw new NotFoundException('Seafarer profile not found');
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

  async deleteSeaService(userId: string, recordId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user || user.role !== 'seafarer' || !user.profile) {
      throw new NotFoundException('Seafarer profile not found');
    }

    const record = await this.prisma.seaServiceRecord.findUnique({
      where: { id: recordId },
    });
    if (!record || record.profileId !== user.profile.id) {
      throw new NotFoundException('Sea service record not found');
    }

    await this.prisma.seaServiceRecord.delete({
      where: { id: recordId },
    });

    return { message: 'Sea service record deleted successfully' };
  }
}
