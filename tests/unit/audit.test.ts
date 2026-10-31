import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { audit, verifyAuditChain } from '@/server/audit';
import { getRootDb } from '@/server/db';

const actor = { id: 'u1', username: 'tester', role: 'doctor', ip: '10.0.0.5' };

describe('audit log', () => {
  it('builds a verifiable hash chain, including jsonb details', async () => {
    await audit(actor, { action: 'patient.view', entity: 'patient', entityId: 'p1', details: { zeta: 1, alpha: { b: 2, a: [1, 'x'] }, skip: undefined } });
    await audit(actor, { action: 'patient.update', entity: 'patient', entityId: 'p1' });
    await audit(null, { action: 'system.job' });
    const res = await verifyAuditChain();
    expect(res.ok).toBe(true);
    expect(res.count).toBe(3);
  });

  it('blocks UPDATE, DELETE and TRUNCATE at the database', async () => {
    const d = await getRootDb();
    await expect(d.execute(sql`UPDATE audit_log SET action = 'x'`)).rejects.toThrow();
    await expect(d.execute(sql`DELETE FROM audit_log`)).rejects.toThrow();
    await expect(d.execute(sql`TRUNCATE audit_log`)).rejects.toThrow();
  });

  it('detects tampering performed by a superuser bypassing triggers', async () => {
    const d = await getRootDb();
    await d.execute(sql`ALTER TABLE audit_log DISABLE TRIGGER audit_log_no_update`);
    await d.execute(sql`UPDATE audit_log SET action = 'patient.edit' WHERE seq = 2`);
    await d.execute(sql`ALTER TABLE audit_log ENABLE TRIGGER audit_log_no_update`);
    const res = await verifyAuditChain();
    expect(res).toMatchObject({ ok: false, brokenAt: 2 });
  });
});
