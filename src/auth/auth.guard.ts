import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];

    // Local developer test token bypass
    if (token === 'mock-master-token') {
      request.user = {
        id: 'a0000000-0000-0000-0000-000000000001', // Raj's ID or similar
        email: 'master@hariomthalassic.com',
        name: 'Master Admin',
        role: 'MASTER',
        status: 'Active',
      };
      return true;
    }

    // Try verifying as NestJS local JWT first
    try {
      const jwt = require('jsonwebtoken');
      const secret = process.env.JWT_SECRET || 'your-secret-key';
      const decoded = jwt.verify(token, secret) as any;
      if (decoded && decoded.role) {
        request.user = {
          id: decoded.sub,
          email: decoded.email,
          role: decoded.role.toUpperCase(),
          status: 'Active',
        };
        return true;
      }
    } catch (e) {
      // Not a valid NestJS JWT, proceed to Supabase check
    }

    const supabase = this.supabaseService.getClient();

    // Verify token with Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException('Invalid or expired authentication session');
    }

    // Fetch custom user profile info (role, status) from our PostgreSQL users table
    const { data: dbUser, error: dbError } = await supabase
      .from('users')
      .select('id, email, name, role, status')
      .eq('email', user.email)
      .single();

    if (dbError || !dbUser) {
      // Return basic auth user if not mapped in public.users yet
      request.user = {
        authId: user.id,
        email: user.email,
        role: 'SEAFARER',
        status: 'Pending Audit',
      };
      return true;
    }

    request.user = dbUser;
    return true;
  }
}
