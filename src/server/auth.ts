import 'server-only';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { username, twoFactor } from 'better-auth/plugins';
import { nextCookies } from 'better-auth/next-js';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { getRootDb, schema } from './db';
import { audit } from './audit';
import { assertStrongPassword } from './passwords';

const SHIFT_SECONDS = 12 * 60 * 60;

// Per-username lockout (SECURITY §2): 5 failures within 15 minutes. Better Auth's own
// rate limiter covers the per-IP side.
const LOCK_WINDOW_MS = 15 * 60_000;
const failures = new Map<string, number[]>();
const recentFailures = (u: string) => (failures.get(u) ?? []).filter((t) => Date.now() - t < LOCK_WINDOW_MS);

async function build() {
  const db = await getRootDb();
  return betterAuth({
    appName: 'ZimMedPractice',
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: (process.env.TRUSTED_ORIGINS ?? '').split(',').filter(Boolean),
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification, twoFactor: schema.twoFactor },
    }),
    advanced: { database: { generateId: () => crypto.randomUUID() }, useSecureCookies: process.env.NODE_ENV === 'production' },
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 10, maxPasswordLength: 128 },
    session: { expiresIn: SHIFT_SECONDS, updateAge: SHIFT_SECONDS, cookieCache: { enabled: false } },
    user: {
      additionalFields: {
        role: { type: 'string', input: false },
        title: { type: 'string', required: false, input: false },
        qualification: { type: 'string', required: false, input: false },
        hpzNumber: { type: 'string', required: false, input: false },
        phone: { type: 'string', required: false, input: false },
        active: { type: 'boolean', input: false },
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      storage: 'memory',
      customRules: {
        '/sign-in/username': { window: 15 * 60, max: 10 },
        '/two-factor/verify-totp': { window: 5 * 60, max: 5 },
        '/two-factor/verify-backup-code': { window: 5 * 60, max: 5 },
        '/change-password': { window: 15 * 60, max: 5 },
      },
    },
    databaseHooks: {
      session: {
        create: {
          // Disabled staff cannot obtain a session
          before: async (s) => {
            const [u] = await db.select({ active: schema.user.active }).from(schema.user).where(eq(schema.user.id, s.userId));
            if (!u?.active) throw new APIError('FORBIDDEN', { message: 'Account disabled' });
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/sign-in/username') {
          const u = String(ctx.body?.username ?? '').toLowerCase();
          if (recentFailures(u).length >= 5) {
            throw new APIError('TOO_MANY_REQUESTS', { message: 'Too many failed attempts. Try again in 15 minutes.' });
          }
        }
        if (ctx.path === '/change-password') assertStrongPassword(String(ctx.body?.newPassword ?? ''));
      }),
      after: createAuthMiddleware(async (ctx) => {
        const ip = ctx.request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
        if (ctx.path === '/sign-in/username') {
          const u = String(ctx.body?.username ?? '').toLowerCase();
          const failed = ctx.context.returned instanceof APIError;
          if (failed) failures.set(u, [...recentFailures(u), Date.now()]);
          else failures.delete(u);
          const actor = ctx.context.newSession?.user;
          await audit(actor ? { id: actor.id, username: u, role: (actor as { role?: string }).role, ip } : { id: '', username: u, ip },
            { action: failed ? 'auth.login_failed' : 'auth.login', details: { username: u } });
        }
        if (ctx.path.startsWith('/two-factor/') || ctx.path === '/sign-out' || ctx.path === '/change-password') {
          const s = ctx.context.session ?? ctx.context.newSession;
          const failed = ctx.context.returned instanceof APIError;
          await audit(s ? { id: s.user.id, username: (s.user as { username?: string }).username, ip } : null,
            { action: `auth${ctx.path.replaceAll('/', '.')}${failed ? '_failed' : ''}` });
        }
      }),
    },
    plugins: [
      username(),
      twoFactor({ issuer: process.env.PRACTICE_SHORT_NAME ?? 'ZimMedPractice', skipVerificationOnEnable: false }),
      nextCookies(),
    ],
  });
}

export type Auth = Awaited<ReturnType<typeof build>>;

const g = globalThis as unknown as { __zimmedAuth?: Promise<Auth> };
export const getAuth = () => (g.__zimmedAuth ??= build());
