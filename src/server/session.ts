import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getAuth } from './auth';
import { can, MFA_REQUIRED_ROLES, type Permission, type Role } from '@/lib/rbac';
import type { Actor } from './audit';

export type SessionUser = {
  id: string;
  name: string;
  username: string;
  role: Role;
  title: string | null;
  qualification: string | null;
  hpzNumber: string | null;
  twoFactorEnabled: boolean;
};

export const mfaEnforced = () => process.env.ENFORCE_2FA !== 'false';
export const needsMfaSetup = (u: SessionUser) => mfaEnforced() && MFA_REQUIRED_ROLES.includes(u.role) && !u.twoFactorEnabled;

export async function sessionFromHeaders(h: Headers): Promise<SessionUser | null> {
  const auth = await getAuth();
  const s = await auth.api.getSession({ headers: h });
  if (!s) return null;
  const u = s.user as typeof s.user & Partial<SessionUser> & { active?: boolean };
  if (u.active === false) return null;
  return {
    id: u.id,
    name: u.name,
    username: u.username ?? '',
    role: u.role as Role,
    title: u.title ?? null,
    qualification: u.qualification ?? null,
    hpzNumber: u.hpzNumber ?? null,
    twoFactorEnabled: !!u.twoFactorEnabled,
  };
}

export const currentUser = cache(async () => sessionFromHeaders(await headers()));

// Server Component guard: signed in, 2FA enrolled where required, and holding `perm`.
export async function requirePage(perm?: Permission): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (needsMfaSetup(user)) redirect('/setup-2fa');
  if (perm && !can(user.role, perm)) redirect('/forbidden');
  return user;
}

export async function pageActor(user: SessionUser): Promise<Actor> {
  const h = await headers();
  return { id: user.id, username: user.username, role: user.role, ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null };
}
