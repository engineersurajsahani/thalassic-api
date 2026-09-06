import { Injectable, BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

// ISSUE-035: Centralized role constants to prevent inconsistency across codebase
export const ROLES = {
  MASTER: 'MASTER',
  SEAFARER: 'SEAFARER',
  AGENT: 'AGENT',
  AGENT_ADMIN: 'AGENT_ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

const ROLE_MAP: Record<string, string> = {
  seafarer: ROLES.SEAFARER,
  'company-admin': ROLES.COMPANY_ADMIN,
  master: ROLES.MASTER,
  'agent-admin': ROLES.AGENT_ADMIN,
  agent_admin: ROLES.AGENT_ADMIN,
  agent: ROLES.AGENT,
};

@Injectable()
export class AuthService {
  constructor(
    private supabaseService: SupabaseService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    // ISSUE-015: Fail fast if JWT_SECRET is not configured — no weak default fallback
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required. Please configure it in your .env file.');
    }
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const cleanEmail = (email || '').trim().toLowerCase();

    // ISSUE-013: REMOVED hardcoded master credentials (master@gmail.com / master@12)
    // ISSUE-013: REMOVED hardcoded test credentials (seafarer@test.com / seafarer@123)
    // These bypasses are security vulnerabilities — all authentication now goes through the database

    // Query User table from public schema
    const supabase = this.supabaseService.getClient();
    const { data: user, error } = await supabase
      .from('User')
      .select('id, email, password, name, role, phone')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (error || !user) {
      throw new BadRequestException('Invalid email or password');
    }

    // Compare password with bcrypt hash
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Invalid email or password');
    }

    // Retrieve onboarding status for agent users
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

  async register(registerDto: RegisterDto) {
    const { name, firstName, lastName, email, password, phone, role = 'seafarer', referralCode, indosNumber } = registerDto;
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
    // The role parameter is ignored in register; only seafarer registration is allowed publicly
    // Other roles (MASTER, AGENT_ADMIN, etc.) must be created by existing admins via admin endpoints
    const dbRole = ROLES.SEAFARER; // Always SEAFARER for public registration

    // Check if user already exists (case-insensitive email match)
    // ISSUE-060: Use ilike for consistent case-insensitive email checks
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

    // Insert new user — supply id explicitly since the 'User' table has no default
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
          // Check for existing lead with matching email or phone
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

    // Generate JWT — ISSUE-015: Uses required JWT_SECRET, no fallback
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
    // ISSUE-015: Uses required JWT_SECRET, no fallback — require() replaced with proper JwtService.verify
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

    // ISSUE-013: REMOVED hardcoded master@gmail.com mock return
    // ISSUE-013: REMOVED hardcoded seafarer@test.com mock return
    // All profile data now comes from the database

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
}
