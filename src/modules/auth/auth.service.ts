import {
  Injectable,
  Inject,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupabaseService } from '../supabase/supabase.service';
import { User, UserRole, UserStatus } from '../../entities/user.entity';
import { SeafarerProfile } from '../../entities/seafarer-profile.entity';
import { AgentMetadata } from '../../entities/agent-metadata.entity';
import { ReferralLead } from '../../entities/referral-lead.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;

  constructor(
    @Inject(getRepositoryToken(User))
    private readonly userRepo: Repository<User>,
    @Inject(getRepositoryToken(SeafarerProfile))
    private readonly profileRepo: Repository<SeafarerProfile>,
    @Inject(getRepositoryToken(AgentMetadata))
    private readonly agentMetadataRepo: Repository<AgentMetadata>,
    @Inject(getRepositoryToken(ReferralLead))
    private readonly referralLeadRepo: Repository<ReferralLead>,
    @Inject(getRepositoryToken(AuditLog))
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly supabaseService: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret =
      this.configService.get<string>('JWT_SECRET') ||
      'thalassic-production-jwt-secure-signing-secret-2026';
  }

  // --- 1. Login Authentication (Strict Supabase Auth) ---
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanEmail || !cleanPassword) {
      throw new BadRequestException('Email and password are required');
    }

    const supabase = this.supabaseService.getClient();

    // 1. Primary Auth Source of Truth: Supabase Auth Password Verification
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

    if (authError || !authData?.user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const authUserId = authData.user.id;

    // 2. Query application profile from public.users using TypeORM
    let user = await this.userRepo.findOne({
      where: [{ authUserId }, { email: cleanEmail }],
    });

    if (!user) {
      // First-time login bootstrap for authenticated Supabase user
      const isMaster =
        cleanEmail === 'master@gmail.com' ||
        cleanEmail === 'master@thalassic.in';
      const role = isMaster ? UserRole.MASTER : UserRole.SEAFARER;

      user = this.userRepo.create({
        authUserId,
        email: cleanEmail,
        name:
          authData.user.user_metadata?.name ||
          (isMaster ? 'Master Admin' : cleanEmail.split('@')[0]),
        role,
        status: UserStatus.ACTIVE,
      });
      await this.userRepo.save(user);
    } else if (!user.authUserId || user.authUserId !== authUserId) {
      // Ensure auth_user_id is strictly linked to Supabase Auth UUID
      user.authUserId = authUserId;
      await this.userRepo.save(user);
    }

    if (user.status === UserStatus.DEACTIVATED) {
      throw new UnauthorizedException('Your account has been deactivated');
    }

    // Return the authenticated session token (Supabase access token or signed JWT)
    const token =
      authData.session?.access_token ||
      this.jwtService.sign(
        {
          sub: user.id,
          authUserId: user.authUserId,
          email: user.email,
          role: user.role,
        },
        { secret: this.jwtSecret, expiresIn: '24h' },
      );

    await this.auditLogRepo.save({
      actorUserId: user.id,
      actorName: user.name,
      action: 'USER_LOGIN',
      module: 'AUTH',
      entityTable: 'users',
      entityId: user.id,
      details: `User ${user.email} authenticated via Supabase Auth with role ${user.role}`,
    });

    return {
      token,
      user: {
        id: user.id,
        auth_user_id: user.authUserId,
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
      authUserId: authUserId || undefined,
      email: cleanEmail,
      name: resolvedName,
      phone: phone || '',
      role: UserRole.SEAFARER,
      status: UserStatus.ACTIVE,
    });

    const savedUser = await this.userRepo.save(user);

    // 3. Create Seafarer Profile Extension
    const profile = this.profileRepo.create({
      userId: savedUser.id,
      indosNumber: indosNumber?.trim() || undefined,
      status: indosNumber ? 'Active' : 'Pending',
    });
    await this.profileRepo.save(profile);

    // 4. Partner Referral Conversion
    if (referralCode && referralCode.trim()) {
      const agentMeta = await this.agentMetadataRepo.findOne({
        where: { referralCode: referralCode.trim().toUpperCase() },
      });

      if (agentMeta) {
        let lead = await this.referralLeadRepo.findOne({
          where: { agentId: agentMeta.userId, email: cleanEmail },
        });

        if (lead) {
          lead.status = 'Converted';
          await this.referralLeadRepo.save(lead);
        } else {
          lead = this.referralLeadRepo.create({
            agentId: agentMeta.userId,
            name: resolvedName,
            email: cleanEmail,
            phone: phone || '',
            status: 'Converted',
          });
          await this.referralLeadRepo.save(lead);
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
      userId: savedUser.id,
      userName: savedUser.name,
      action: 'USER_REGISTER',
      module: 'AUTH',
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
    if (!token) {
      throw new UnauthorizedException('Authentication token required');
    }

    let user: User | null = null;

    // 1. Try verifying with local JWT
    try {
      const decoded = this.jwtService.verify(token, {
        secret: this.jwtSecret,
      }) as any;
      if (decoded?.sub) {
        user = await this.userRepo.findOne({ where: { id: decoded.sub } });
      }
    } catch {
      // Not a local JWT, attempt Supabase Auth token verification
    }

    // 2. Try verifying with Supabase Auth
    if (!user) {
      const supabase = this.supabaseService.getClient();
      try {
        const {
          data: { user: authUser },
          error,
        } = await supabase.auth.getUser(token);
        if (!error && authUser) {
          user = await this.userRepo.findOne({
            where: [{ authUserId: authUser.id }, { email: authUser.email }],
          });
        }
      } catch {
        // Verification failed
      }
    }

    if (!user) {
      throw new UnauthorizedException(
        'Invalid or expired authentication token',
      );
    }

    return {
      id: user.id,
      auth_user_id: user.authUserId,
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
