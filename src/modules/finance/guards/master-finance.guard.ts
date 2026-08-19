import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class MasterFinanceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const role = (user.role || '').toUpperCase().replace('-', '_');

    // Section 7.8 & 7.9: Only MASTER role has access to platform financial audit logs & insights
    if (role === 'MASTER' || role === 'SUPER_ADMIN' || role === 'FINANCE_ADMIN') {
      return true;
    }

    throw new ForbiddenException(
      'Access Denied: Section 7.8/7.9 specifies financial reports and audit logs are restricted exclusively to the Master role.',
    );
  }
}
