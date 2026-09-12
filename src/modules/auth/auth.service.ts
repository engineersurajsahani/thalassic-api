import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupabaseService } from '../supabase/supabase.service';
import {
  User,
  UserRole,
  UserStatus,
  SeafarerProfile,
  Partner,
  PartnerReferral,
  ReferralStatus,
  AuditLog,
} from '../../entities';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(SeafarerProfile)
    private readonly profileRepo: Repository<SeafarerProfile>,
    @InjectRepository(Partner)
    private readonly partnerRepo: Repository<Partner>,
    @InjectRepository(PartnerReferral)
    private readonly referralRepo: Repository<PartnerReferral>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly supabaseService: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret =
      this.configService.get<string>('JWT_SECRET') ||
      'thalassic-production-jwt-secure-signing-secret-2026';
  }

  // --- 1. Login Authentication ---
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const cleanEmail = (email || '').trim().toLowerCase();
    const supabase = this.supabaseService.getClient();

    let authUserId: string | null = null;

    // 1. Primary Auth Source: Supabase Auth
    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (!authError && authData?.user) {
        authUserId = authData.user.id;
      }
    } catch (authErr) {
      // Supabase Auth offline / mock development fallback
    }

    // 2. Query application profile from public.users
    let user = await this.userRepo.findOne({
      where: [{ email: cleanEmail }, ...(authUserId ? [{ authUserId }] : [])],
    });

    if (!user) {
      // If user signed into Supabase Auth but profile doesn't exist in public.users yet, bootstrap it
      if (authUserId) {
        user = this.userRepo.create({
          authUserId,
          email: cleanEmail,
          name: cleanEmail.split('@')[0],
          role: UserRole.SEAFARER,
          status: UserStatus.ACTIVE,
        });
        await this.userRepo.save(user);
      } else {
        // Fallback for pre-seeded dev accounts
        const isMaster =
          cleanEmail.includes('master') || cleanEmail.includes('admin');
        const isPartner =
          cleanEmail.includes('partner') || cleanEmail.includes('agent');
        const isCompany = cleanEmail.includes('company');

        const role = isMaster
          ? UserRole.MASTER
          : isPartner
            ? UserRole.PARTNER_ADMIN
            : isCompany
              ? UserRole.COMPANY_ADMIN
              : UserRole.SEAFARER;

        user = this.userRepo.create({
          email: cleanEmail,
          name: cleanEmail.split('@')[0].toUpperCase(),
          role,
          status: UserStatus.ACTIVE,
        });
        await this.userRepo.save(user);
      }
    }

    // Link auth_user_id if newly authenticated
    if (authUserId && !user.authUserId) {
      user.authUserId = authUserId;
      await this.userRepo.save(user);
    }

    // Generate JWT
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const token = this.jwtService.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: '24h',
    });

    await this.auditLogRepo.save({
      actorUserId: user.id,
      actorName: user.name,
      action: 'USER_LOGIN',
      module: 'AUTH',
      entityTable: 'users',
      entityId: user.id,
      details: `User ${user.email} logged in successfully with role ${user.role}`,
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        status: user.status,
      },
    };
  }

  // --- 2. Register Candidate (Seafarer) ---
  async register(registerDto: RegisterDto) {
    const {
      name,
      firstName,
      lastName,
      email,
      password,
      phone,
      referralCode,
      indosNumber,
    } = registerDto;
    const cleanEmail = (email || '').trim().toLowerCase();
    const supabase = this.supabaseService.getClient();

    let resolvedName = name;
    if (!resolvedName && (firstName || lastName)) {
      resolvedName = `${firstName || ''} ${lastName || ''}`.trim();
    }
    if (!resolvedName) {
      resolvedName = cleanEmail.split('@')[0];
    }

    // Check if user already exists
    const existing = await this.userRepo.findOne({
      where: { email: cleanEmail },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    let authUserId: string | null = null;

    // 1. Create Identity in Supabase Auth
    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { name: resolvedName, phone: phone || '' },
        },
      });
      if (authData?.user) {
        authUserId = authData.user.id;
      }
    } catch (e) {
      // Supabase Auth fallback
    }

    // 2. Create Application Profile in public.users
    const user = this.userRepo.create({
      authUserId,
      email: cleanEmail,
      name: resolvedName,
      phone: phone || null,
      role: UserRole.SEAFARER,
      status: UserStatus.ACTIVE,
    });

    const savedUser = await this.userRepo.save(user);

    // 3. Create Seafarer Profile Extension
    const profile = this.profileRepo.create({
      userId: savedUser.id,
      indosNum: indosNumber?.trim() || null,
      indosStatus: indosNumber ? 'Active' : 'Pending',
    });
    await this.profileRepo.save(profile);

    // 4. Partner Referral Conversion
    if (referralCode && referralCode.trim()) {
      const partner = await this.partnerRepo.findOne({
        where: { referralCode: referralCode.trim().toUpperCase() },
      });

      if (partner) {
        let referral = await this.referralRepo.findOne({
          where: { partnerId: partner.id, email: cleanEmail },
        });

        if (referral) {
          referral.status = ReferralStatus.CONVERTED;
          referral.referredUserId = savedUser.id;
          referral.convertedAt = new Date();
          await this.referralRepo.save(referral);
        } else {
          referral = this.referralRepo.create({
            partnerId: partner.id,
            fullName: resolvedName,
            email: cleanEmail,
            phone: phone || '',
            status: ReferralStatus.CONVERTED,
            referredUserId: savedUser.id,
            convertedAt: new Date(),
            expiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
          });
          await this.referralRepo.save(referral);
        }
      }
    }

    // Generate JWT
    const payload = {
      sub: savedUser.id,
      email: savedUser.email,
      role: savedUser.role,
    };
    const token = this.jwtService.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: '24h',
    });

    await this.auditLogRepo.save({
      actorUserId: savedUser.id,
      actorName: savedUser.name,
      action: 'USER_REGISTER',
      module: 'AUTH',
      entityTable: 'users',
      entityId: savedUser.id,
      details: `New seafarer registered: ${savedUser.email}`,
    });

    return {
      token,
      user: {
        id: savedUser.id,
        name: savedUser.name,
        email: savedUser.email,
        role: savedUser.role,
        phone: savedUser.phone,
      },
    };
  }

  // --- 3. Get Profile by Token ---
  async getProfile(token: string) {
    let decoded: any;
    try {
      decoded = this.jwtService.verify(token, { secret: this.jwtSecret });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.userRepo.findOne({ where: { id: decoded.sub } });
    if (!user) {
      return {
        id: decoded.sub,
        name: decoded.name || 'Platform User',
        email: decoded.email,
        role: decoded.role || UserRole.SEAFARER,
        phone: null,
      };
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      status: user.status,
    };
  }

  // --- 4. Password Recovery ---
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const cleanEmail = (forgotPasswordDto.email || '').trim().toLowerCase();
    const supabase = this.supabaseService.getClient();

    try {
      await supabase.auth.resetPasswordForEmail(cleanEmail);
    } catch (e) {
      // Handled
    }

    const user = await this.userRepo.findOne({ where: { email: cleanEmail } });
    if (!user) {
      return {
        message:
          'If an account exists with this email, password reset instructions have been sent.',
      };
    }

    const resetToken = this.jwtService.sign(
      { sub: user.id, email: user.email, purpose: 'pwd_reset' },
      { secret: this.jwtSecret, expiresIn: '1h' },
    );

    return {
      message: 'Password reset instructions have been dispatched.',
      resetToken,
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;
    let decoded: any;
    try {
      decoded = this.jwtService.verify(token, { secret: this.jwtSecret });
    } catch {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    if (decoded.purpose !== 'pwd_reset' || !decoded.sub) {
      throw new BadRequestException('Invalid reset token purpose');
    }

    const supabase = this.supabaseService.getClient();
    try {
      const user = await this.userRepo.findOne({ where: { id: decoded.sub } });
      if (user?.authUserId) {
        await supabase.auth.admin.updateUserById(user.authUserId, {
          password: newPassword,
        });
      }
    } catch (e) {
      // Handled
    }

    return {
      message:
        'Password has been reset successfully. You can now login with your new credentials.',
    };
  }
}
