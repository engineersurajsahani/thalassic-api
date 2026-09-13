import { SetMetadata } from '@nestjs/common';

// ISSUE-035: Centralized role constants
export const ROLES = {
  MASTER: 'MASTER',
  SEAFARER: 'SEAFARER',
  AGENT: 'AGENT',
  AGENT_ADMIN: 'AGENT_ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) =>
  SetMetadata(ROLES_KEY, roles);
