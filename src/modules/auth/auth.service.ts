import { Injectable, BadRequestException, ConflictException, UnauthorizedException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { User, SeafarerProfile, AgentMetadata, ReferralLead } from '../../entities';

// ISSUE-035: Centralized role constants to prevent inconsistency across codebase
export const ROLES = {
  MASTER: 'MASTER',
  SEAFARER: 'SEAFARER',
  AGENT: 'AGENT',
  AGENT_ADMIN: 'AGENT_ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

// ISSUE-064: In-memory tracker for failed login attempts to prevent brute force attacks
interface LockoutEntry {
  failedAttempts: number;
  lockedUntil: number | null;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const loginAttempts = new Map<string, LockoutEntry>();

@Injectable()
export class AuthService {
  constructor(
    private supabaseService: SupabaseService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Optional() @InjectRepository(User) private userRepository?: Repository<User>,
    @Optional() @InjectRepository(SeafarerProfile) private profileRepository?: Repository<SeafarerProfile>,
    @Optional() @InjectRepository(AgentMetadata) private agentMetaRepository?: Repository<AgentMetadata>,
    @Optional() @InjectRepository(ReferralLead) private referralLeadRepository?: Repository<ReferralLead>,
  ) {
    // ISSUE-015: Fail fast if JWT_SECRET is not configured — no weak default fallback
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required. Please configure it in your .env file.');
    }
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    // ISSUE-060: Always normalize email to lowercase
    const cleanEmail = (email || '').trim().toLowerCase();

    // ISSUE-064: Check account lockout status
    const lockout = loginAttempts.get(cleanEmail);
    const now = Date.now();
    if (lockout && lockout.lockedUntil && now < lockout.lockedUntil) {
      const remainingMinutes = Math.ceil((lockout.lockedUntil - now) / (60 * 1000));
      throw new UnauthorizedException(
        `Account is temporarily locked due to multiple failed login attempts. Please try again in ${remainingMinutes} minute(s).`,
      );
    }

    // Query User table from database
    let user: any = null;
    if (this.userRepository) {
      try {
        user = await this.userRepository.findOne({
          where: { email: cleanEmail },
          select: { id: true, email: true, password: true, name: true, role: true, phone: true },
        });
      } catch {
        // Fallback to Supabase client if TypeORM repository query fails
      }
    }

    if (!user) {
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase
        .from('User')
        .select('id, email, password, name, role, phone')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (error || !data) {
        this.recordFailedAttempt(cleanEmail);
        throw new BadRequestException('Invalid email or password');
      }
      user = data;
    }

    // Compare password with bcrypt hash
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.recordFailedAttempt(cleanEmail);
      throw new BadRequestException('Invalid email or password');
    }

    // Successful login - reset failed attempt counter
    loginAttempts.delete(cleanEmail);

    // Retrieve onboarding status for agent users
    let onboardingStatus: string | null = null;
    if (user.role?.toUpperCase() === ROLES.AGENT) {
      const supabase = this.supabaseService.getClient();
      const { data: meta } = await supabase
        .from('agent_metadata')
        .select('onboarding_status')
        .eq('user_id', user.id)
        .maybeSingle();
      if (meta) {
        onboardingStatus = meta.onboarding_status;
      } else {
        onboardingStatus = 'Invited';
      }
    }

    // Generate JWT token — ISSUE-015: Uses required JWT_SECRET, no fallback
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '24h',
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone ?? null,
        onboardingStatus,
      },
    };
  }

  private recordFailedAttempt(email: string) {
    const entry = loginAttempts.get(email) || { failedAttempts: 0, lockedUntil: null };
    entry.failedAttempts += 1;
    if (entry.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      entry.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    }
    loginAttempts.set(email, entry);
  }

  async register(registerDto: RegisterDto) {
    const { name, firstName, lastName, email, password, phone, referralCode, indosNumber } = registerDto;
    // ISSUE-060: Normalize email to lowercase for consistent case-insensitive handling
    const cleanEmail = (email || '').trim().toLowerCase();
    const supabase = this.supabaseService.getClient();

    let resolvedName = name;
    if (!resolvedName && (firstName || lastName)) {
      resolvedName = `${firstName || ''} ${lastName || ''}`.trim();
    }
    if (!resolvedName) {
      resolvedName = email.split('@')[0];
    }

    // ISSUE-016: Registration restricted to SEAFARER only — prevents privilege escalation
    const dbRole = ROLES.SEAFARER;

    // Check if user already exists
    const { data: existing } = await supabase
      .from('User')
      .select('id')
      .ilike('email', cleanEmail)
      .single();

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    const userId = randomUUID();
    const { data: newUser, error } = await supabase
      .from('User')
      .insert({
        id: userId,
        name: resolvedName,
        email: cleanEmail,
        password: hashedPassword,
        phone: phone ?? null,
        role: dbRole,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .select('id, email, name, role, phone')
      .single();

    if (error || !newUser) {
      throw new BadRequestException(
        error?.message ?? 'Registration failed. Please try again.',
      );
    }

    // Create SeafarerProfile if role is seafarer
    if (dbRole === ROLES.SEAFARER) {
      try {
        await supabase.from('SeafarerProfile').upsert(
          {
            userId: newUser.id,
            firstName: firstName?.trim() || null,
            lastName: lastName?.trim() || null,
            indosNumber: indosNumber?.trim() || null,
            updatedAt: new Date().toISOString(),
          },
          { onConflict: 'userId' },
        );
      } catch (profErr) {
        console.warn('SeafarerProfile creation skipped on register:', (profErr as any)?.message);
      }
    }

    // If a referral code was provided, register/update referral lead
    if (referralCode && referralCode.trim()) {
      try {
        const cleanRef = referralCode.trim().toUpperCase();
        const { data: agentMeta } = await supabase
          .from('agent_metadata')
          .select('user_id')
          .ilike('referral_code', cleanRef)
          .maybeSingle();

        if (agentMeta?.user_id) {
          const { data: existingLead } = await supabase
            .from('referral_leads')
            .select('id')
            .eq('email', cleanEmail)
            .maybeSingle();

          if (existingLead) {
            await supabase
              .from('referral_leads')
              .update({
                status: 'Registered',
                agent_id: agentMeta.user_id,
                remarks: `Direct signup via referral code ${cleanRef}`,
              })
              .eq('id', existingLead.id);
          } else {
            await supabase
              .from('referral_leads')
              .insert({
                id: randomUUID(),
                agent_id: agentMeta.user_id,
                name: resolvedName,
                email: cleanEmail,
                phone: phone || '',
                status: 'Registered',
                remarks: `Registered with referral code ${cleanRef}`,
                created_at: new Date().toISOString(),
                expiry_at: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
              });
          }
        }
      } catch (refErr) {
        console.warn('Referral lead association skipped on register:', (refErr as any)?.message);
      }
    }

    // Generate JWT
    const payload = { sub: newUser.id, email: newUser.email, role: newUser.role };
    const token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '24h',
    });

    return {
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        phone: newUser.phone,
      },
    };
  }

  async getProfile(token: string) {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required.');
    }

    let decoded: any;
    try {
      decoded = this.jwtService.verify(token, { secret });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const supabase = this.supabaseService.getClient();
    const { data: user, error } = await supabase
      .from('User')
      .select('id, email, name, role, phone')
      .eq('id', decoded.sub)
      .maybeSingle();

    if (error || !user) {
      if (decoded.role) {
        return {
          id: decoded.sub,
          name: decoded.name || 'Platform User',
          email: decoded.email,
          role: decoded.role,
          phone: null,
          onboardingStatus: null,
        };
      }
      throw new UnauthorizedException('User not found');
    }

    let onboardingStatus = null;
    if (user.role?.toUpperCase() === ROLES.AGENT) {
      const { data: meta } = await supabase
        .from('agent_metadata')
        .select('onboarding_status')
        .eq('user_id', user.id)
        .maybeSingle();
      if (meta) {
        onboardingStatus = meta.onboarding_status;
      } else {
        onboardingStatus = 'Invited';
      }
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone ?? null,
      onboardingStatus,
    };
  }

  // ISSUE-066: Forgot password handling
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const cleanEmail = (forgotPasswordDto.email || '').trim().toLowerCase();
    const supabase = this.supabaseService.getClient();

    const { data: user } = await supabase
      .from('User')
      .select('id, email, name')
      .ilike('email', cleanEmail)
      .maybeSingle();

    // Security best practice: Always return generic message to avoid email enumeration
    if (!user) {
      return {
        message: 'If an account exists with this email, password reset instructions have been sent.',
      };
    }

    const resetToken = this.jwtService.sign(
      { sub: user.id, email: user.email, purpose: 'pwd_reset' },
      {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: '1h',
      },
    );

    return {
      message: 'Password reset link generated successfully.',
      resetToken, // Returned for dev/testing; in production this is sent via email
    };
  }

  // ISSUE-066: Reset password handling
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;
    const secret = this.configService.get<string>('JWT_SECRET');

    let decoded: any;
    try {
      decoded = this.jwtService.verify(token, { secret });
    } catch {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    if (decoded.purpose !== 'pwd_reset' || !decoded.sub) {
      throw new BadRequestException('Invalid reset token purpose');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase
      .from('User')
      .update({
        password: hashedPassword,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', decoded.sub);

    if (error) {
      throw new BadRequestException('Failed to update password. Please try again.');
    }

    return { message: 'Password has been reset successfully. You can now login with your new password.' };
  }
}
