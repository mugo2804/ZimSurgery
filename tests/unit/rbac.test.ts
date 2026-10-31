import { describe, expect, it } from 'vitest';
import { can, ROLE_PERMISSIONS, type Role } from '@/lib/rbac';

describe('RBAC matrix (SECURITY §4)', () => {
  it('keeps clinical notes away from admin and reception', () => {
    for (const role of ['admin', 'reception'] as Role[]) {
      expect(can(role, 'clinical:read')).toBe(false);
      expect(can(role, 'clinical:write')).toBe(false);
      expect(can(role, 'vitals:write')).toBe(false);
    }
  });

  it('only doctors write clinical notes', () => {
    expect(can('doctor', 'clinical:write')).toBe(true);
    expect(can('nurse', 'clinical:write')).toBe(false);
    expect(can('nurse', 'clinical:read')).toBe(true);
    expect(can('nurse', 'vitals:write')).toBe(true);
  });

  it('restricts money and administration', () => {
    expect(can('doctor', 'billing:write')).toBe(false);
    expect(can('nurse', 'billing:read')).toBe(false);
    expect(can('reception', 'billing:write')).toBe(true);
    expect(can('reception', 'invoices:void')).toBe(false);
    expect(can('admin', 'invoices:void')).toBe(true);
    for (const role of ['doctor', 'nurse', 'reception'] as Role[]) {
      expect(can(role, 'admin:users')).toBe(false);
      expect(can(role, 'audit:view')).toBe(false);
      expect(can(role, 'reports:view')).toBe(false);
    }
  });

  it('denies unknown roles', () => {
    expect(can(undefined, 'patients:read')).toBe(false);
    expect(can('janitor' as Role, 'patients:read')).toBe(false);
  });

  it('has no duplicate permissions per role', () => {
    for (const perms of Object.values(ROLE_PERMISSIONS)) expect(new Set(perms).size).toBe(perms.length);
  });
});
