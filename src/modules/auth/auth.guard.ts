import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { SupabaseService } from '../supabase/supabase.service';
import { ROLES } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    // ISSUE-018: REMOVED query string token support (?token= or ?auth=)
    // Tokens should ONLY be passed via Authorization header for security

    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    // ISSUE-014: REMOVED mock-master-token bypass entirely
    // No magic strings or hardcoded bypasses allowed

    // Try verifying as NestJS local JWT first
    try {
      // ISSUE-015: Use required JWT_SECRET from config, no fallback to weak default
      // Access config through process.env directly (or inject ConfigService)
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new UnauthorizedException('JWT_SECRET not configured');
      }

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

    // Fetch custom user profile info (role, status) from our PostgreSQL User table
    const { data: dbUser, error: dbError } = await supabase
      .from('User')
      .select('id, email, name, role, status')
      .eq('email', user.email)
      .single();

    if (dbError || !dbUser) {
      // Return basic auth user if not mapped in public.users yet
      request.user = {
        id: user.id,
        email: user.email,
        role: ROLES.SEAFARER,
        status: 'Pending Audit',
      };
      return true;
    }

    request.user = dbUser;
    return true;
  }
}
