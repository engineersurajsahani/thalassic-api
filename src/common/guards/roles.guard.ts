import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, ROLES, UserRole } from '../decorators/roles.decorator';

function normalizeRole(role: string): string {
  if (role === 'PARTNER_ADMIN' || role === 'AGENT_ADMIN')
    return 'PARTNER_ADMIN';
  if (role === 'PARTNER' || role === 'AGENT') return 'PARTNER';
  return role;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<
      (typeof ROLES)[keyof typeof ROLES][]
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) {
      return false;
    }
    const userRole = normalizeRole(user.role);
    return requiredRoles.some(
      (role) => user.role === role || normalizeRole(role) === userRole,
    );
  }
}
