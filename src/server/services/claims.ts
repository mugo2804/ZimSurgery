import 'server-only';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, nextNumber } from '../db';
import { claimBatches, invoiceItems, invoices, medicalAids, patients, payments, user, visits } from '../db/schema';
import { audit, type Actor } from '../audit';
import { HttpError, notFound } from '../errors';
import { getSettings } from './settings';
import { sendEmail, emailConfigured } from '../email';
import { toCents } from '@/lib/money';
import { fmtDate, localDay } from '@/lib/time';
import { claimBatchInput, remittanceInput } from '@/lib/billing-schemas';

type A = NonNullable<Actor>;

export async function pendingClaims() {
  const d = await db();
  return d.select({
    id: invoices.id, invoiceNo: invoices.invoiceNo, createdAt: invoices.createdAt, aidCents: invoices.aidCents, totalCents: invoices.totalCents,
    medicalAidId: invoices.medicalAidId, aid: medicalAids.name, memberNo: invoices.memberNo, dependantCode: invoices.dependantCode,
    firstName: patients.firstName, lastName: patients.lastName,
  }).from(invoices).innerJoin(patients, eq(patients.id, invoices.patientId)).innerJoin(medicalAids, eq(medicalAids.id, invoices.medicalAidId))
    .where(and(eq(invoices.claimStatus, 'pending'), sql`${invoices.status} <> 'void'`)).orderBy(asc(medicalAids.name), asc(invoices.createdAt));
}

export async function listBatches() {
  const d = await db();
  return d.select({ b: claimBatches, aid: medicalAids.name, count: sql<number>`(select count(*) from invoices where claim_batch_id = ${claimBatches.id})`.mapWith(Number) })
    .from(claimBatches).innerJoin(medicalAids, eq(medicalAids.id, claimBatches.medicalAidId)).orderBy(desc(claimBatches.createdAt)).limit(100);
}

export async function createBatch(actor: A, input: z.output<typeof claimBatchInput>) {
  const d = await db();
  const rows = await d.select().from(invoices).where(inArray(invoices.id, input.invoiceIds));
  if (rows.length !== input.invoiceIds.length) throw notFound('Invoice');
  for (const r of rows) {
    if (r.medicalAidId !== input.medicalAidId) throw new HttpError(400, `${r.invoiceNo} belongs to a different medical aid`);
    if (r.claimStatus !== 'pending' || r.status === 'void') throw new HttpError(400, `${r.invoiceNo} is not awaiting a claim`);
  }
  const totalCents = rows.reduce((s, r) => s + r.aidCents, 0);
  const [batch] = await d.insert(claimBatches).values({ batchNo: await nextNumber('claim', 'CLM-'), medicalAidId: input.medicalAidId, totalCents, createdBy: actor.id })
    .returning({ id: claimBatches.id, batchNo: claimBatches.batchNo });
  await d.update(invoices).set({ claimStatus: 'batched', claimBatchId: batch.id }).where(inArray(invoices.id, input.invoiceIds));
  await audit(actor, { action: 'claims.batch_create', entity: 'claim_batch', entityId: batch.id, details: { invoices: rows.length, totalCents } });
  return batch;
}

export async function getBatch(id: string) {
  const d = await db();
  const [row] = await d.select({ b: claimBatches, aid: medicalAids }).from(claimBatches).innerJoin(medicalAids, eq(medicalAids.id, claimBatches.medicalAidId)).where(eq(claimBatches.id, id));
  if (!row) throw notFound('Claim batch');
  const inv = await d.select({
    id: invoices.id, invoiceNo: invoices.invoiceNo, createdAt: invoices.createdAt, aidCents: invoices.aidCents, totalCents: invoices.totalCents,
    claimStatus: invoices.claimStatus, claimPaidCents: invoices.claimPaidCents, claimNote: invoices.claimNote, memberNo: invoices.memberNo,
    dependantCode: invoices.dependantCode, firstName: patients.firstName, lastName: patients.lastName, dob: patients.dob, principal: patients.maPrincipalName,
    doctor: user.name, hpz: user.hpzNumber, serviceDate: visits.checkedInAt,
  }).from(invoices).innerJoin(patients, eq(patients.id, invoices.patientId)).leftJoin(visits, eq(visits.id, invoices.visitId)).leftJoin(user, eq(user.id, visits.doctorId))
    .where(eq(invoices.claimBatchId, id)).orderBy(asc(invoices.invoiceNo));
  const items = inv.length ? await d.select().from(invoiceItems).where(inArray(invoiceItems.invoiceId, inv.map((i) => i.id))) : [];
  return { ...row.b, aid: row.aid, invoices: inv.map((i) => ({ ...i, items: items.filter((x) => x.invoiceId === i.id) })) };
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  // Neutralise spreadsheet formula injection and quote when needed
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

// Generic line-level claim file. Societies' own formats differ — adjust columns here per aid if required.
export async function batchCsv(actor: A, id: string) {
  const b = await getBatch(id);
  const s = await getSettings();
  const header = ['batch_no', 'practice', 'practice_no', 'invoice_no', 'service_date', 'member_no', 'dependant_code', 'principal_member',
    'patient_name', 'patient_dob', 'icd10', 'tariff_code', 'description', 'qty', 'unit_price_usd', 'claimed_usd', 'treating_doctor', 'doctor_reg_no'];
  const lines = [header.join(',')];
  for (const i of b.invoices) {
    for (const it of i.items) {
      if (it.aidTotalCents <= 0) continue;
      lines.push([
        b.batchNo, s.practice_name, s.ahfoz_practice_no, i.invoiceNo, i.serviceDate ? localDay(i.serviceDate) : localDay(i.createdAt), i.memberNo, i.dependantCode,
        i.principal, `${i.firstName} ${i.lastName}`, i.dob, it.icd10, it.code, it.description, it.qty, (it.aidUnitCents / 100).toFixed(2),
        (it.aidTotalCents / 100).toFixed(2), i.doctor, i.hpz,
      ].map(csvCell).join(','));
    }
  }
  await audit(actor, { action: 'claims.export', entity: 'claim_batch', entityId: id, details: { lines: lines.length - 1 } });
  return { filename: `${b.batchNo}-${b.aid.code ?? 'aid'}.csv`, csv: lines.join('\r\n') + '\r\n' };
}

export async function emailBatch(actor: A, id: string) {
  if (!emailConfigured()) throw new HttpError(400, 'Email (SMTP) is not configured. Download the CSV and send it manually.');
  const b = await getBatch(id);
  if (!b.aid.claimsEmail) throw new HttpError(400, `No claims email address is set for ${b.aid.name}`);
  const { filename, csv } = await batchCsv(actor, id);
  const s = await getSettings();
  await sendEmail({
    to: b.aid.claimsEmail,
    subject: `Claims batch ${b.batchNo} — ${s.practice_name} (${s.ahfoz_practice_no})`,
    text: `Dear Claims Department,\n\nPlease find attached claims batch ${b.batchNo} containing ${b.invoices.length} invoice(s), total US$${(b.totalCents / 100).toFixed(2)}.\n\nRegards,\n${s.practice_name}\n${s.practice_phone}`,
    attachments: [{ filename, content: csv, contentType: 'text/csv' }],
  });
  const d = await db();
  await d.update(claimBatches).set({ emailedAt: new Date(), status: 'submitted', submittedAt: b.submittedAt ?? new Date() }).where(eq(claimBatches.id, id));
  await d.update(invoices).set({ claimStatus: 'submitted' }).where(and(eq(invoices.claimBatchId, id), eq(invoices.claimStatus, 'batched')));
  await audit(actor, { action: 'claims.email', entity: 'claim_batch', entityId: id, details: { to: b.aid.claimsEmail } });
  return { ok: true, to: b.aid.claimsEmail };
}

export async function setBatchStatus(actor: A, id: string, status: 'submitted' | 'rejected', notes?: string) {
  const d = await db();
  const [b] = await d.select().from(claimBatches).where(eq(claimBatches.id, id));
  if (!b) throw notFound('Claim batch');
  if (b.status === 'paid') throw new HttpError(400, 'This batch has already been paid');
  await d.update(claimBatches).set({ status, notes: notes ?? b.notes, ...(status === 'submitted' ? { submittedAt: b.submittedAt ?? new Date() } : {}) }).where(eq(claimBatches.id, id));
  if (status === 'submitted') await d.update(invoices).set({ claimStatus: 'submitted' }).where(and(eq(invoices.claimBatchId, id), eq(invoices.claimStatus, 'batched')));
  // A whole-batch rejection returns the invoices to the pending pool so they can be corrected and re-batched
  if (status === 'rejected') await d.update(invoices).set({ claimStatus: 'pending', claimBatchId: null }).where(and(eq(invoices.claimBatchId, id), inArray(invoices.claimStatus, ['batched', 'submitted'])));
  await audit(actor, { action: `claims.batch_${status}`, entity: 'claim_batch', entityId: id, details: { notes } });
  return { ok: true };
}

// Remittance advice: what the society actually paid per invoice. Paid amounts post as medical_aid payments.
export async function recordRemittance(actor: A, id: string, input: z.output<typeof remittanceInput>) {
  const d = await db();
  const b = await getBatch(id);
  if (b.status === 'rejected') throw new HttpError(400, 'This batch was rejected');
  const receiptNo = await nextNumber('receipt', 'RCT-');
  let paidTotal = 0;
  for (const line of input.lines) {
    const inv = b.invoices.find((i) => i.id === line.invoiceId);
    if (!inv) throw new HttpError(400, 'Invoice is not in this batch');
    if (inv.claimStatus === 'paid' || inv.claimStatus === 'rejected') continue;
    const paidCents = toCents(line.paid);
    if (paidCents > inv.aidCents) throw new HttpError(400, `${inv.invoiceNo}: paid amount exceeds the claimed amount`);
    const [row] = await d.select({ patientId: invoices.patientId }).from(invoices).where(eq(invoices.id, inv.id));
    if (paidCents > 0) {
      await d.insert(payments).values({
        receiptNo, invoiceId: inv.id, patientId: row.patientId, method: 'medical_aid', currency: 'USD', amountMinor: paidCents, usdCents: paidCents,
        reference: input.reference ?? b.batchNo, receivedBy: actor.id,
      });
    }
    await d.update(invoices).set({
      claimPaidCents: paidCents, claimStatus: line.rejected || paidCents === 0 ? 'rejected' : 'paid', claimNote: line.note ?? null,
    }).where(eq(invoices.id, inv.id));
    paidTotal += paidCents;
  }
  const [{ open }] = await d.select({ open: sql<number>`count(*)`.mapWith(Number) }).from(invoices)
    .where(and(eq(invoices.claimBatchId, id), inArray(invoices.claimStatus, ['batched', 'submitted'])));
  await d.update(claimBatches).set({
    paidCents: sql`${claimBatches.paidCents} + ${paidTotal}`,
    ...(open === 0 ? { status: 'paid' as const, paidAt: new Date() } : {}),
  }).where(eq(claimBatches.id, id));
  await audit(actor, { action: 'claims.remittance', entity: 'claim_batch', entityId: id, details: { paidTotal, lines: input.lines.length, reference: input.reference } });
  return { ok: true, paidTotal, complete: open === 0, printedOn: fmtDate(new Date()) };
}
