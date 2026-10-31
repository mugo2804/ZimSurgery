import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z, ZodError } from 'zod';
import { eq } from 'drizzle-orm';
import { db, withTx } from './db';
import { idempotencyKeys } from './db/schema';
import { HttpError } from './errors';
import { sessionFromHeaders, needsMfaSetup, type SessionUser } from './session';
import { can, type Permission } from '@/lib/rbac';
import type { Actor } from './audit';

type Schema = z.ZodType;
type Ctx<B extends Schema | undefined, Q extends Schema | undefined> = {
  req: NextRequest;
  user: SessionUser;
  actor: Actor;
  body: B extends Schema ? z.infer<B> : undefined;
  query: Q extends Schema ? z.infer<Q> : undefined;
  params: Record<string, string>;
};

type Options<B extends Schema | undefined, Q extends Schema | undefined> = {
  /** Any one of these permissions grants access */
  perm: Permission | Permission[];
  body?: B;
  query?: Q;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The single entry point for every API route (docs/ARCHITECTURE.md §2):
 * session → 2FA enrolment → RBAC → origin check → idempotency → validation → transaction → error mapping.
 */
export function route<B extends Schema | undefined = undefined, Q extends Schema | undefined = undefined>(
  opts: Options<B, Q>,
  handler: (ctx: Ctx<B, Q>) => Promise<unknown>,
) {
  return async (req: NextRequest, segment: { params: Promise<Record<string, string>> }) => {
    try {
      const user = await sessionFromHeaders(req.headers);
      if (!user) throw new HttpError(401, 'Not signed in or session expired');
      if (needsMfaSetup(user)) throw new HttpError(403, 'Two-factor authentication must be set up first');
      const perms = Array.isArray(opts.perm) ? opts.perm : [opts.perm];
      if (!perms.some((p) => can(user.role, p))) throw new HttpError(403, 'You do not have permission for this action');

      const mutating = req.method !== 'GET' && req.method !== 'HEAD';
      if (mutating) assertSameOrigin(req);

      const params = (await segment?.params) ?? {};
      for (const [k, v] of Object.entries(params)) {
        if (k.endsWith('id') || k === 'id') if (!UUID.test(v)) throw new HttpError(400, `Invalid ${k}`);
      }

      const actor: Actor = { id: user.id, username: user.username, role: user.role, ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null };
      const query = opts.query ? opts.query.parse(Object.fromEntries(req.nextUrl.searchParams)) : undefined;

      if (!mutating) {
        const result = await handler({ req, user, actor, params, query, body: undefined } as Ctx<B, Q>);
        return result instanceof Response ? result : NextResponse.json(result ?? { ok: true }, { headers: noStore });
      }

      const idemKey = req.headers.get('idempotency-key');
      if (idemKey) {
        if (!/^[\w-]{8,100}$/.test(idemKey)) throw new HttpError(400, 'Invalid Idempotency-Key');
        const d = await db();
        const [hit] = await d.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, `${user.id}:${idemKey}`));
        if (hit) return NextResponse.json(hit.body, { status: hit.status, headers: { ...noStore, 'Idempotent-Replay': 'true' } });
      }

      const raw = opts.body ? await req.json().catch(() => { throw new HttpError(400, 'Request body must be JSON'); }) : undefined;
      const body = opts.body ? opts.body.parse(raw) : undefined;

      const result = await withTx(async () => {
        const out = await handler({ req, user, actor, params, query, body } as Ctx<B, Q>);
        if (idemKey && !(out instanceof Response)) {
          await (await db()).insert(idempotencyKeys).values({ key: `${user.id}:${idemKey}`, userId: user.id, status: 200, body: out ?? { ok: true } });
        }
        return out;
      });
      return result instanceof Response ? result : NextResponse.json(result ?? { ok: true }, { headers: noStore });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

const noStore = { 'Cache-Control': 'no-store' };

function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (!origin) return; // same-origin fetches from older browsers / server-to-server
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (new URL(origin).host !== host) throw new HttpError(403, 'Cross-origin request rejected');
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json({ ...err.extra, error: err.message, fields: err.fields }, { status: err.status, headers: noStore });
  }
  if (err instanceof ZodError) {
    const fields = z.flattenError(err).fieldErrors as Record<string, string[]>;
    const first = err.issues[0];
    return NextResponse.json(
      { error: first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input', fields },
      { status: 400, headers: noStore },
    );
  }
  // Never echo internals or request data (may contain PHI) — log the message only
  console.error('[api] unhandled error:', err instanceof Error ? err.message : String(err));
  return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500, headers: noStore });
}

// Common Zod building blocks
export const zId = z.uuid();
export const zOptText = (max = 500) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
export const zDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
