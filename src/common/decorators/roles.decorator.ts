import { SetMetadata } from '@nestjs/common';

export const ROLES = {
  MASTER: 'MASTER',
  SEAFARER: 'SEAFARER',
  PARTNER: 'PARTNER',
  PARTNER_ADMIN: 'PARTNER_ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  AGENT: 'PARTNER',
  AGENT_ADMIN: 'PARTNER_ADMIN',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
