import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: passwordHash,
        name: dto.name,
        phone: dto.phone,
        role: dto.role,
        profile: dto.role === 'seafarer' ? {
          create: {
            dob: '',
            nationality: '',
            indosNumber: '',
            address: '',
            profilePicture: '',
          }
        } : undefined,
      },
    });

    const token = await this.signToken(user.id, user.email, user.name, user.role);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = await this.signToken(user.id, user.email, user.name, user.role);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        profile: {
          include: {
            seaService: true,
          }
        }
      }
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  private async signToken(userId: string, email: string, name: string, role: string): Promise<string> {
    const payload = { sub: userId, email, name, role };
    return this.jwtService.signAsync(payload, {
      secret: 'JWT_SECRET_KEY_HARI_OM_THALASSIC_2026',
    });
  }
}
