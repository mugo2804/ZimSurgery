import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { verifyPassword } from 'better-auth/crypto';
import { route } from '@/server/api';
import { db } from '@/server/db';
import { account } from '@/server/db/schema';
import { audit } from '@/server/audit';
import { HttpError } from '@/server/errors';

// Re-checks the signed-in user's password to dismiss the idle lock screen
export const POST = route({ perm: 'patients:read', body: z.object({ password: z.string().min(1).max(128) }) }, async ({ user, actor, body }) => {
  const [acc] = await (await db()).select({ password: account.password }).from(account)
    .where(and(eq(account.userId, user.id), eq(account.providerId, 'credential')));
  const ok = !!acc?.password && (await verifyPassword({ hash: acc.password, password: body.password }));
  await audit(actor, { action: ok ? 'auth.unlock' : 'auth.unlock_failed' });
  if (!ok) throw new HttpError(400, 'Incorrect password');
  return { ok: true };
});
