import { Injectable, BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

// Map frontend role slugs → DB enum values
const ROLE_MAP: Record<string, string> = {
  seafarer: 'SEAFARER',
  'company-admin': 'COMPANY_ADMIN',
  company_admin: 'COMPANY_ADMIN',
  master: 'MASTER',
  'agent-admin': 'AGENT_ADMIN',
  agent_admin: 'AGENT_ADMIN',
  agent: 'AGENT',
  partner: 'AGENT',
};

const USERS_FILE = path.join(process.cwd(), 'users_data.json');

const DEFAULT_USERS = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    email: 'master@gmail.com',
    plainPassword: 'master@12',
    name: 'Master Admin',
    role: 'MASTER',
    phone: '+91 91111 22222',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000002',
    email: 'seafarer@test.com',
    plainPassword: 'seafarer@123',
    name: 'Rohan Sharma',
    role: 'SEAFARER',
    phone: '+91 98765 11223',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000003',
    email: 'admin2@shippingco.com',
    plainPassword: 'Password123!',
    name: 'Shipping Co Admin',
    role: 'COMPANY_ADMIN',
    phone: '+91 98888 33333',
  },
  {
    id: '58f7dc83-cb27-4547-8264-ed433b557103',
    email: 'kishan1@gmail.com',
    plainPassword: 'kishan123',
    name: 'Kishan (Hari Om Partner)',
    role: 'AGENT',
    phone: '+91 98200 44556',
    onboardingStatus: 'Active',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000008',
    email: 'agentadmin@thalassic.in',
    plainPassword: 'Password123!',
    name: 'Agent Admin Head',
    role: 'AGENT_ADMIN',
    phone: '+91 88888 11111',
    onboardingStatus: 'Active',
  },
  {
    id: '58f7dc83-cb27-4547-8264-ed433b557103',
    email: 'partner@test.com',
    plainPassword: 'partner@123',
    name: 'Hari Om Global Partner',
    role: 'AGENT',
    phone: '+91 99999 55555',
    onboardingStatus: 'Active',
  },
  {
    id: '58f7dc83-cb27-4547-8264-ed433b557103',
    email: 'agent@thalassic.in',
    plainPassword: 'password123',
    name: 'Hari Om Partner Agency',
    role: 'AGENT',
    phone: '+91 99999 88888',
    onboardingStatus: 'Active',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000005',
    email: 'admin@thalassic.in',
    plainPassword: 'password123',
    name: 'Partner Admin',
    role: 'AGENT_ADMIN',
    phone: '+91 88888 77777',
    onboardingStatus: 'Active',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000006',
    email: 'priya@example.com',
    plainPassword: 'password123',
    name: 'Priya Singh',
    role: 'SEAFARER',
    phone: '+91 99887 76655',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000007',
    email: 'raj@example.com',
    plainPassword: 'password123',
    name: 'Raj Kumar',
    role: 'SEAFARER',
    phone: '+91 98765 43210',
  }
];

@Injectable()
export class AuthService {
  constructor(
    private supabaseService: SupabaseService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) { }

  private readLocalUsers(): any[] {
    try {
      if (fs.existsSync(USERS_FILE)) {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      }
    } catch (e) {
      console.error('Error reading users_data.json:', e);
    }
    return DEFAULT_USERS;
  }

  private saveLocalUser(user: any) {
    try {
      const users = this.readLocalUsers();
      const existingIdx = users.findIndex((u) => u.email?.toLowerCase() === user.email?.toLowerCase());
      if (existingIdx >= 0) {
        users[existingIdx] = { ...users[existingIdx], ...user };
      } else {
        users.push(user);
      }
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving local user:', e);
    }
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const normalizedEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    console.log(`[AUTH] Login attempt for: ${normalizedEmail}`);

    let user: any = null;

    // 1. Check local users list and default users FIRST for instant local reliability
    const localUsers = this.readLocalUsers();
    const defaultMatch = DEFAULT_USERS.find((u) => u.email.toLowerCase() === normalizedEmail);
    const localMatch = localUsers.find((u) => (u.email || '').toLowerCase() === normalizedEmail);
    user = localMatch || defaultMatch;

    // 2. If not found locally, try querying Supabase
    if (!user) {
      try {
        const supabase = this.supabaseService.getClient();
        const { data, error } = await supabase
          .from('User')
          .select('id, email, password, name, role, phone')
          .ilike('email', normalizedEmail)
          .maybeSingle();

        if (!error && data) {
          user = data;
        }
      } catch (err) {
        console.warn('Supabase lookup failed:', err);
      }
    }

    if (!user) {
      console.warn(`[AUTH] User not found: ${normalizedEmail}`);
      throw new BadRequestException('Invalid email or password');
    }

    // 3. Check password validity
    let isPasswordValid = false;

    // Check plainPassword on user
    if (user.plainPassword && (user.plainPassword === cleanPassword || user.plainPassword === password)) {
      isPasswordValid = true;
    }

    // Check plainPassword on defaultMatch
    if (!isPasswordValid && defaultMatch && (defaultMatch.plainPassword === cleanPassword || defaultMatch.plainPassword === password)) {
      isPasswordValid = true;
    }

    // Check bcrypt hash
    if (!isPasswordValid && user.password) {
      try {
        isPasswordValid = (await bcrypt.compare(cleanPassword, user.password)) || (await bcrypt.compare(password, user.password));
      } catch {
        isPasswordValid = false;
      }
    }

    // Direct password match fallback
    if (!isPasswordValid && (user.password === cleanPassword || user.password === password)) {
      isPasswordValid = true;
    }

    if (!isPasswordValid) {
      console.warn(`[AUTH] Password invalid for: ${normalizedEmail}`);
      throw new BadRequestException('Invalid email or password');
    }

    // Retrieve onboarding status
    let onboardingStatus = user.onboardingStatus || 'Active';
    if (user.role?.toUpperCase() === 'AGENT') {
      try {
        const supabase = this.supabaseService.getClient();
        const { data: meta } = await supabase
          .from('agent_metadata')
          .select('onboarding_status')
          .eq('user_id', user.id)
          .maybeSingle();
        if (meta?.onboarding_status) {
          onboardingStatus = meta.onboarding_status;
        }
      } catch {
        onboardingStatus = 'Active';
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

    console.log(`[AUTH] Login successful for: ${normalizedEmail} with role ${user.role}`);

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
    const normalizedEmail = (email || '').trim().toLowerCase();
    const dbRole = ROLE_MAP[role] ?? 'SEAFARER';

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUserId = randomUUID();

    const newUserObj = {
      id: newUserId,
      name,
      email: normalizedEmail,
      password: hashedPassword,
      plainPassword: password,
      phone: phone ?? null,
      role: dbRole,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      onboardingStatus: dbRole === 'AGENT' ? 'Active' : undefined,
    };

    // Save locally
    this.saveLocalUser(newUserObj);

    // Also attempt Supabase insert
    try {
      const supabase = this.supabaseService.getClient();
      await supabase.from('User').insert({
        id: newUserId,
        name,
        email: normalizedEmail,
        password: hashedPassword,
        phone: phone ?? null,
        role: dbRole,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Supabase registration insert skipped, saved locally.');
    }

    // Generate JWT
    const payload = { sub: newUserId, email: normalizedEmail, role: dbRole };
    const token = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET') || 'your-secret-key',
      expiresIn: '24h',
    });

    return {
      token,
      user: {
        id: newUserId,
        name,
        email: normalizedEmail,
        role: dbRole,
        phone: phone ?? null,
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

    let user: any = null;

    // 1. Try Supabase
    try {
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase
        .from('User')
        .select('id, email, name, role, phone')
        .eq('id', decoded.sub)
        .maybeSingle();

      if (!error && data) {
        user = data;
      }
    } catch {
      console.warn('Supabase profile query failed, checking fallback.');
    }

    // 2. Fallback
    if (!user) {
      const localUsers = this.readLocalUsers();
      user = localUsers.find((u) => u.id === decoded.sub || u.email?.toLowerCase() === decoded.email?.toLowerCase()) ||
        DEFAULT_USERS.find((u) => u.id === decoded.sub || u.email?.toLowerCase() === decoded.email?.toLowerCase());
    }

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    let onboardingStatus = user.onboardingStatus || (user.role?.toUpperCase() === 'AGENT' ? 'Active' : null);

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
