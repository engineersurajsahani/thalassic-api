import { Injectable, BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

// Map frontend role slugs → DB enum values
const ROLE_MAP: Record<string, string> = {
  seafarer: 'SEAFARER',
  'company-admin': 'COMPANY_ADMIN',
  master: 'MASTER',
  'agent-admin': 'AGENT_ADMIN',
  agent_admin: 'AGENT_ADMIN',
  agent: 'AGENT',
};

@Injectable()
export class AuthService {
  constructor(
    private supabaseService: SupabaseService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) { }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const cleanEmail = (email || '').trim().toLowerCase();

    // 1. Support company designated credentials
    if (cleanEmail === 'master@gmail.com' && (password === 'master@12' || password === 'master@123')) {
      const user = {
        id: 'a0000000-0000-0000-0000-000000000000',
        name: 'Master Administrator',
        email: 'master@gmail.com',
        role: 'MASTER',
        phone: '+91 22 12345678',
      };
      const token = this.jwtService.sign(
        { sub: user.id, email: user.email, role: user.role },
        { secret: this.configService.get<string>('JWT_SECRET') || 'your-secret-key', expiresIn: '24h' }
      );
      return { token, user: { ...user, onboardingStatus: null } };
    }

    if (cleanEmail === 'seafarer@test.com' && (password === 'seafarer@123' || password === 'seafarer@12')) {
      const user = {
        id: '36032b6a-60c8-4417-a928-83c44400506c',
        name: 'Test Seafarer',
        email: 'seafarer@test.com',
        role: 'SEAFARER',
        phone: '+91 98765 43210',
      };
      const token = this.jwtService.sign(
        { sub: user.id, email: user.email, role: user.role },
        { secret: this.configService.get<string>('JWT_SECRET') || 'your-secret-key', expiresIn: '24h' }
      );
      return { token, user: { ...user, onboardingStatus: null } };
    }

    // 2. Query User table from public schema
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
    if (user.role?.toUpperCase() === 'AGENT') {
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

    // Generate JWT token
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET') || 'your-secret-key',
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
    const { name, email, password, phone, role = 'seafarer' } = registerDto;
    const supabase = this.supabaseService.getClient();

    // Map frontend role slug to DB enum value
    const dbRole = ROLE_MAP[role] ?? 'SEAFARER';

    // Check if user already exists
    const { data: existing } = await supabase
      .from('User')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user — supply id explicitly since the 'User' table has no default
    const { data: newUser, error } = await supabase
      .from('User')
      .insert({
        id: randomUUID(),
        name,
        email,
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

    // Generate JWT
    const payload = { sub: newUser.id, email: newUser.email, role: newUser.role };
    const token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET') || 'your-secret-key',
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
    const jwt = require('jsonwebtoken');
    const secret = this.configService.get<string>('JWT_SECRET') || 'your-secret-key';

    let decoded: any;
    try {
      decoded = jwt.verify(token, secret);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (decoded.email === 'master@gmail.com') {
      return {
        id: decoded.sub || 'a0000000-0000-0000-0000-000000000000',
        name: 'Master Administrator',
        email: 'master@gmail.com',
        role: 'MASTER',
        phone: '+91 22 12345678',
        onboardingStatus: null,
      };
    }

    if (decoded.email === 'seafarer@test.com') {
      return {
        id: decoded.sub || '36032b6a-60c8-4417-a928-83c44400506c',
        name: 'Test Seafarer',
        email: 'seafarer@test.com',
        role: 'SEAFARER',
        phone: '+91 98765 43210',
        onboardingStatus: null,
      };
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
    if (user.role?.toUpperCase() === 'AGENT') {
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
