import 'server-only';
import { hashPassword } from 'better-auth/crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { account, session, twoFactor, user, type Role } from '../db/schema';
import { assertStrongPassword } from '../passwords';
import { conflict, notFound } from '../errors';

export type NewStaff = {
  username: string;
  name: string;
  role: Role;
  password: string;
  title?: string | null;
  qualification?: string | null;
  hpzNumber?: string | null;
  phone?: string | null;
  email?: string | null;
};

// Staff are created by the practice manager (public sign-up is disabled). We write the
// Better Auth user + credential account rows directly using its own password hasher.
export async function createStaff(input: NewStaff) {
  assertStrongPassword(input.password);
  const d = await db();
  const uname = input.username.trim().toLowerCase();
  const [existing] = await d.select({ id: user.id }).from(user).where(eq(user.username, uname));
  if (existing) throw conflict('That username is already taken');
  const id = crypto.randomUUID();
  await d.insert(user).values({
    id,
    name: input.name,
    email: input.email?.trim().toLowerCase() || `${uname}@staff.local`,
    username: uname,
    displayUsername: input.username.trim(),
    role: input.role,
    title: input.title ?? null,
    qualification: input.qualification ?? null,
    hpzNumber: input.hpzNumber ?? null,
    phone: input.phone ?? null,
  });
  await d.insert(account).values({
    id: crypto.randomUUID(),
    accountId: id,
    providerId: 'credential',
    userId: id,
    password: await hashPassword(input.password),
  });
  return id;
}

export async function setPassword(userId: string, password: string) {
  assertStrongPassword(password);
  const d = await db();
  const res = await d.update(account).set({ password: await hashPassword(password) })
    .where(and(eq(account.userId, userId), eq(account.providerId, 'credential'))).returning({ id: account.id });
  if (!res.length) throw notFound('User');
  await revokeSessions(userId);
}

export async function revokeSessions(userId: string) {
  await (await db()).delete(session).where(eq(session.userId, userId));
}

export async function resetTwoFactor(userId: string) {
  const d = await db();
  await d.delete(twoFactor).where(eq(twoFactor.userId, userId));
  await d.update(user).set({ twoFactorEnabled: false }).where(eq(user.id, userId));
  await revokeSessions(userId);
}
