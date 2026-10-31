// Permission matrix from docs/SECURITY.md §4. Shared by server (enforcement) and client (menus).
// The UI hiding something is convenience only — every route re-checks on the server.

export type Role = 'admin' | 'doctor' | 'nurse' | 'reception';

export const PERMISSIONS = [
  'patients:read', 'patients:write',
  'appointments:read', 'appointments:write',
  'queue:read', 'queue:write', 'queue:clinical',
  'vitals:write', 'procedures:write',
  'clinical:read', 'clinical:write', 'labs:result',
  'billing:read', 'billing:write', 'invoices:void',
  'claims:manage', 'cashup:view', 'cashup:all',
  'reports:view',
  'stock:read', 'stock:write',
  'messages:send',
  'admin:users', 'admin:settings', 'audit:view',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const common: Permission[] = ['patients:read', 'patients:write', 'appointments:read', 'appointments:write', 'queue:read', 'queue:write', 'messages:send'];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  // Practice manager: money, schedules, users, audit — deliberately no clinical:*
  admin: [...common, 'billing:read', 'billing:write', 'invoices:void', 'claims:manage', 'cashup:view', 'cashup:all',
    'reports:view', 'stock:read', 'stock:write', 'admin:users', 'admin:settings', 'audit:view'],
  doctor: [...common, 'queue:clinical', 'vitals:write', 'procedures:write', 'clinical:read', 'clinical:write', 'labs:result',
    'billing:read', 'stock:read'],
  nurse: [...common, 'queue:clinical', 'vitals:write', 'procedures:write', 'clinical:read', 'labs:result', 'stock:read', 'stock:write'],
  reception: [...common, 'billing:read', 'billing:write', 'claims:manage', 'cashup:view'],
};

export const can = (role: Role | undefined | null, perm: Permission): boolean => !!role && (ROLE_PERMISSIONS[role]?.includes(perm) ?? false);

// 2FA is mandatory for these roles (SECURITY §2)
export const MFA_REQUIRED_ROLES: Role[] = ['admin', 'doctor'];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Practice Manager',
  doctor: 'Doctor',
  nurse: 'Nurse',
  reception: 'Reception',
};
