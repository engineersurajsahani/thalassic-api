import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { SupabaseService } from '../supabase/supabase.service';
import { ROLES } from '../../common/decorators/roles.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    // Try verifying as NestJS local JWT first
    try {
      const secret =
        process.env.JWT_SECRET ||
        'thalassic-production-jwt-secure-signing-secret-2026';
      const decoded = jwt.verify(token, secret) as any;
      if (decoded && decoded.role) {
        request.user = {
          id: decoded.sub,
          sub: decoded.sub,
          email: decoded.email,
          role: decoded.role.toUpperCase(),
          status: 'Active',
        };
        return true;
      }
    } catch (e) {
      // Not a valid local JWT, proceed to Supabase check
    }

    const supabase = this.supabaseService.getClient();

    // Verify token with Supabase Auth
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedException(
          'Invalid or expired authentication session',
        );
      }

      const { data: dbUser } = await supabase
        .from('users')
        .select('id, email, name, role, status')
        .eq('email', user.email)
        .maybeSingle();

      if (!dbUser) {
        request.user = {
          id: user.id,
          sub: user.id,
          email: user.email,
          role: ROLES.SEAFARER,
          status: 'Active',
        };
        return true;
      }

      request.user = {
        id: dbUser.id,
        sub: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        status: dbUser.status,
      };
      return true;
    } catch (err) {
      throw new UnauthorizedException(
        'Invalid or expired authentication session',
      );
    }
  }
}
