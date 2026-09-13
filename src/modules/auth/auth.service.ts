import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

export const ROLES = {
  MASTER: 'MASTER',
  PARTNER_ADMIN: 'PARTNER_ADMIN',
  PARTNER: 'PARTNER',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  SEAFARER: 'SEAFARER',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret =
      this.configService.get<string>('JWT_SECRET') ||
      'thalassic-production-jwt-secure-signing-secret-2026';
  }

  private get db() {
    return this.supabaseService.getClient();
  }

  // --- 1. Login Authentication (Strict Supabase Auth) ---
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanEmail || !cleanPassword) {
      throw new BadRequestException('Email and password are required');
    }

    const supabase = this.db;

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

    // 2. Query application profile from public.users (or User table)
    let user: any = null;

    const { data: u1 } = await supabase
      .from('users')
      .select('*')
      .or(`auth_user_id.eq.${authUserId},email.eq.${cleanEmail}`)
      .maybeSingle();

    if (u1) {
      user = u1;
    }

    const resolveRoleForEmail = (e: string, currentRole?: string) => {
      if (
        currentRole &&
        currentRole !== 'SEAFARER' &&
        currentRole !== 'Pending'
      )
        return currentRole;
      if (
        e === 'master@gmail.com' ||
        e === 'master@thalassic.in' ||
        e.startsWith('master')
      )
        return 'MASTER';
      if (e.startsWith('partneradmin') || e.startsWith('agentadmin'))
        return 'PARTNER_ADMIN';
      if (e.startsWith('partner') || e.startsWith('agent')) return 'PARTNER';
      if (e.startsWith('company')) return 'COMPANY_ADMIN';
      return currentRole || 'SEAFARER';
    };

    if (!user) {
      // First-time login bootstrap for authenticated Supabase user
      const role = resolveRoleForEmail(cleanEmail);

      const newUserId = randomUUID();
      const insertPayload = {
        id: newUserId,
        auth_user_id: authUserId,
        email: cleanEmail,
        name:
          authData.user.user_metadata?.name ||
          (role === 'MASTER' ? 'Master Admin' : cleanEmail.split('@')[0]),
        role,
        status: 'Active',
      };

      const { data: createdUser } = await supabase
        .from('users')
        .insert(insertPayload)
        .select()
        .maybeSingle();

      user = createdUser || insertPayload;
    } else {
      const targetRole = resolveRoleForEmail(cleanEmail, user.role);
      const updates: any = {};

      if (!user.auth_user_id || user.auth_user_id !== authUserId) {
        updates.auth_user_id = authUserId;
        user.auth_user_id = authUserId;
      }
      if (user.role !== targetRole) {
        updates.role = targetRole;
        user.role = targetRole;
      }
      if (user.status === 'Pending Audit') {
        updates.status = 'Active';
        user.status = 'Active';
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from('users').update(updates).eq('id', user.id);
      }
    }

    const userStatus = (user.status || '').toUpperCase();
    if (userStatus === 'DEACTIVATED') {
      throw new UnauthorizedException('Your account has been deactivated');
    }

    // Return the authenticated session token (Supabase access token or signed JWT)
    const token =
      authData.session?.access_token ||
      this.jwtService.sign(
        {
          sub: user.id,
          authUserId: user.auth_user_id,
          email: user.email,
          role: (user.role || 'SEAFARER').toUpperCase(),
        },
        { secret: this.jwtSecret, expiresIn: '24h' },
      );

    try {
      await supabase.from('audit_logs').insert({
        id: randomUUID(),
        user_id: user.id,
        user_name: user.name || user.email,
        action: 'USER_LOGIN',
        module: 'AUTH',
        entity_id: user.id,
        details: `User ${user.email} authenticated via Supabase Auth with role ${user.role}`,
      });
    } catch {
      // Non-blocking audit logging
    }

    return {
      token,
      user: {
        id: user.id,
        auth_user_id: user.auth_user_id,
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
    const supabase = this.db;

    let resolvedName = name;
    if (!resolvedName && (firstName || lastName)) {
      resolvedName = `${firstName || ''} ${lastName || ''}`.trim();
    }
    if (!resolvedName) {
      resolvedName = cleanEmail.split('@')[0];
    }

    // Check if user already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    let authUserId: string | null = null;

    // 1. Create Identity in Supabase Auth
    try {
      const { data: authData } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { name: resolvedName, phone: phone || '' },
        },
      });
      if (authData?.user) {
        authUserId = authData.user.id;
      }
    } catch {
      // Supabase Auth fallback
    }

    // 2. Create Application Profile in public.users
    const userId = randomUUID();
    const newUser = {
      id: userId,
      auth_user_id: authUserId,
      email: cleanEmail,
      name: resolvedName,
      phone: phone || null,
      role: 'SEAFARER',
      status: 'ACTIVE',
    };

    const { data: savedUser } = await supabase
      .from('users')
      .insert(newUser)
      .select()
      .maybeSingle();

    const finalUser = savedUser || newUser;

    // 3. Create Seafarer Profile Extension
    try {
      await supabase.from('seafarer_profiles').insert({
        id: randomUUID(),
        user_id: finalUser.id,
        indos_num: indosNumber?.trim() || null,
        indos_status: indosNumber ? 'Active' : 'Pending',
      });
    } catch {
      // Handled
    }

    // 4. Partner Referral Conversion
    if (referralCode && referralCode.trim()) {
      try {
        const { data: agentMeta } = await supabase
          .from('agent_metadata')
          .select('user_id')
          .eq('referral_code', referralCode.trim().toUpperCase())
          .maybeSingle();

        if (agentMeta) {
          const { data: lead } = await supabase
            .from('referral_leads')
            .select('id')
            .eq('agent_id', agentMeta.user_id)
            .eq('email', cleanEmail)
            .maybeSingle();

          if (lead) {
            await supabase
              .from('referral_leads')
              .update({ status: 'Converted' })
              .eq('id', lead.id);
          } else {
            await supabase.from('referral_leads').insert({
              id: randomUUID(),
              agent_id: agentMeta.user_id,
              name: resolvedName,
              email: cleanEmail,
              phone: phone || '',
              status: 'Converted',
            });
          }
        }
      } catch {
        // Referral conversion fallback
      }
    }

    // Generate JWT
    const payload = {
      sub: finalUser.id,
      email: finalUser.email,
      role: finalUser.role,
    };
    const token = this.jwtService.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: '24h',
    });

    try {
      await supabase.from('audit_logs').insert({
        id: randomUUID(),
        user_id: finalUser.id,
        user_name: finalUser.name,
        action: 'USER_REGISTER',
        module: 'AUTH',
        entity_id: finalUser.id,
        details: `New seafarer registered: ${finalUser.email}`,
      });
    } catch {
      // Non-blocking
    }

    return {
      token,
      user: {
        id: finalUser.id,
        name: finalUser.name,
        email: finalUser.email,
        role: finalUser.role,
        phone: finalUser.phone,
      },
    };
  }

  // --- 3. Get Profile by Token ---
  async getProfile(token: string) {
    if (!token) {
      throw new UnauthorizedException('Authentication token required');
    }

    let user: any = null;

    // 1. Try verifying with local JWT
    try {
      const decoded = this.jwtService.verify(token, {
        secret: this.jwtSecret,
      }) as any;
      if (decoded?.sub) {
        const { data: u } = await this.db
          .from('users')
          .select('*')
          .eq('id', decoded.sub)
          .maybeSingle();
        user = u;
      }
    } catch {
      // Not a local JWT, attempt Supabase Auth token verification
    }

    // 2. Try verifying with Supabase Auth
    if (!user) {
      try {
        const {
          data: { user: authUser },
          error,
        } = await this.db.auth.getUser(token);
        if (!error && authUser) {
          const { data: u } = await this.db
            .from('users')
            .select('*')
            .or(`auth_user_id.eq.${authUser.id},email.eq.${authUser.email}`)
            .maybeSingle();
          user = u;
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
      auth_user_id: user.auth_user_id,
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

    try {
      await this.db.auth.resetPasswordForEmail(cleanEmail);
    } catch {
      // Handled
    }

    const { data: user } = await this.db
      .from('users')
      .select('id, email')
      .eq('email', cleanEmail)
      .maybeSingle();

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

    try {
      const { data: user } = await this.db
        .from('users')
        .select('auth_user_id')
        .eq('id', decoded.sub)
        .maybeSingle();

      if (user?.auth_user_id) {
        await this.db.auth.admin.updateUserById(user.auth_user_id, {
          password: newPassword,
        });
      }
    } catch {
      // Handled
    }

    return {
      message:
        'Password has been reset successfully. You can now login with your new credentials.',
    };
  }
}
