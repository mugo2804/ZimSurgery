import 'server-only';
import { createHash } from 'node:crypto';
import { asc, desc, sql } from 'drizzle-orm';
import { db, withTx } from './db';
import { auditLog } from './db/schema';

export type Actor = { id: string; username?: string | null; role?: string | null; ip?: string | null } | null;

export type AuditEvent = {
  action: string;
  entity?: string;
  entityId?: string;
  patientId?: string | null;
  details?: Record<string, unknown>;
};

const GENESIS = '0'.repeat(64);

type HashInput = {
  prevHash: string; at: string; userId: string | null; action: string; entity: string | null;
  entityId: string | null; patientId: string | null; details: unknown; ip: string | null;
};

// jsonb does not preserve key order, so hash a key-sorted serialisation
function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
}

export function rowHash(r: HashInput): string {
  return createHash('sha256')
    .update([r.prevHash, r.at, r.userId ?? '', r.action, r.entity ?? '', r.entityId ?? '', r.patientId ?? '',
      r.details == null ? '' : canonical(r.details), r.ip ?? ''].join('|'))
    .digest('hex');
}

// Writes inside the caller's transaction. An advisory lock serialises writers so the
// hash chain stays linear even with concurrent requests on PostgreSQL.
export function audit(actor: Actor, ev: AuditEvent) {
  return withTx(() => appendAudit(actor, ev));
}

async function appendAudit(actor: Actor, ev: AuditEvent) {
  const d = await db();
  await d.execute(sql`SELECT pg_advisory_xact_lock(727274)`);
  const [prev] = await d.select({ hash: auditLog.hash }).from(auditLog).orderBy(desc(auditLog.seq)).limit(1);
  const row = {
    prevHash: prev?.hash ?? GENESIS,
    at: new Date().toISOString(),
    userId: actor?.id ?? null,
    action: ev.action,
    entity: ev.entity ?? null,
    entityId: ev.entityId ?? null,
    patientId: ev.patientId ?? null,
    // Round-trip so undefined-valued keys are dropped exactly as they will be in jsonb
    details: ev.details ? JSON.parse(JSON.stringify(ev.details)) : null,
    ip: actor?.ip ?? null,
  };
  await d.insert(auditLog).values({
    ...row,
    at: new Date(row.at),
    username: actor?.username ?? 'system',
    role: actor?.role ?? null,
    hash: rowHash(row),
  });
}

export async function verifyAuditChain(): Promise<{ ok: boolean; count: number; brokenAt?: number }> {
  const d = await db();
  const rows = await d.select().from(auditLog).orderBy(asc(auditLog.seq));
  let prev = GENESIS;
  for (const r of rows) {
    const expected = rowHash({ ...r, at: r.at.toISOString() });
    if (r.prevHash !== prev || r.hash !== expected) return { ok: false, count: rows.length, brokenAt: r.seq };
    prev = r.hash;
  }
  return { ok: true, count: rows.length };
}
