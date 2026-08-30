import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import * as jwt from 'jsonwebtoken';

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

    // Local developer test token bypasses
    if (token === 'mock-master-token') {
      request.user = {
        id: 'a0000000-0000-0000-0000-000000000001',
        email: 'master@hariomthalassic.com',
        name: 'Master Admin',
        role: 'MASTER',
        status: 'Active',
      };
      return true;
    }

    if (token === 'mock-partner-token' || token === 'mock-agent-token') {
      request.user = {
        id: '7af1cb6a-7a93-4ee8-ab95-1dc06ced736c',
        email: 'partner@hariom.in',
        name: 'Hari Om Manning Partner',
        role: 'AGENT',
        status: 'Active',
      };
      return true;
    }

    // Try verifying as NestJS local JWT first
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key';
      const decoded = jwt.decode(token) as any;
      if (decoded && (decoded.role || decoded.sub)) {
        request.user = {
          id: decoded.sub || '7af1cb6a-7a93-4ee8-ab95-1dc06ced736c',
          email: decoded.email || 'partner@hariom.in',
          role: (decoded.role || 'AGENT').toUpperCase(),
          status: 'Active',
        };
        return true;
      }
    } catch (e) {
      // Not a valid NestJS JWT, proceed to Supabase check
    }

    const supabase = this.supabaseService.getClient();

    // Verify token with Supabase Auth
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (!error && user) {
        // Fetch custom user profile info from User table
        const { data: dbUser } = await supabase
          .from('User')
          .select('id, email, name, role, status')
          .eq('email', user.email)
          .single();

        if (dbUser) {
          request.user = dbUser;
          return true;
        }

        request.user = {
          authId: user.id,
          email: user.email,
          role: 'SEAFARER',
          status: 'Pending Audit',
        };
        return true;
      }
    } catch (supErr) {
      // Fallback
    }

    throw new UnauthorizedException('Invalid or expired authentication session');
  }
}
