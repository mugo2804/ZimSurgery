import 'server-only';
import { and, asc, desc, eq, gte, inArray, lt, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, nextNumber } from '../db';
import {
  appointments, cashups, consultations, diagnoses, exchangeRates, invoiceItems, invoices, medicalAids, patients, payments,
  tariffAidRates, tariffs, user, visits, visitStatusLog,
} from '../db/schema';
import { audit, type Actor } from '../audit';
import { emit } from '../events';
import { HttpError, notFound } from '../errors';
import { currentRate } from './settings';
import { priceLines, toCents, usdToZigCents, zigToUsdCents } from '@/lib/money';
import { dayBounds, localDay } from '@/lib/time';
import { cashupInput, invoiceItemsInput, paymentInput, rateInput, tariffInput } from '@/lib/billing-schemas';

type A = NonNullable<Actor>;

// ───────── Tariffs & exchange rate ─────────

export async function listTariffs(includeInactive = false) {
  const d = await db();
  const rows = await d.select().from(tariffs).where(includeInactive ? undefined : eq(tariffs.active, true)).orderBy(asc(tariffs.category), asc(tariffs.code));
  const overrides = await d.select().from(tariffAidRates);
  return rows.map((t) => ({ ...t, aidRates: overrides.filter((o) => o.tariffId === t.id) }));
}

export async function saveTariff(actor: A, id: string | null, input: z.output<typeof tariffInput>) {
  const d = await db();
  const values = { code: input.code, description: input.description, category: input.category ?? null, cashCents: toCents(input.cashPrice), aidCents: toCents(input.aidPrice), active: input.active };
  const clash = await d.select({ id: tariffs.id }).from(tariffs).where(and(eq(tariffs.code, input.code), id ? ne(tariffs.id, id) : undefined));
  if (clash.length) throw new HttpError(409, `Tariff code ${input.code} already exists`);
  let tariffId = id;
  if (id) {
    const res = await d.update(tariffs).set(values).where(eq(tariffs.id, id)).returning({ id: tariffs.id });
    if (!res.length) throw notFound('Tariff');
  } else {
    tariffId = (await d.insert(tariffs).values(values).returning({ id: tariffs.id }))[0].id;
  }
  await d.delete(tariffAidRates).where(eq(tariffAidRates.tariffId, tariffId!));
  if (input.aidRates.length) {
    await d.insert(tariffAidRates).values(input.aidRates.map((r) => ({ tariffId: tariffId!, medicalAidId: r.medicalAidId, aidCents: toCents(r.price) })));
  }
  await audit(actor, { action: id ? 'tariff.update' : 'tariff.create', entity: 'tariff', entityId: tariffId!, details: { code: input.code, cash: values.cashCents, aid: values.aidCents } });
  return { id: tariffId };
}

export async function setExchangeRate(actor: A, input: z.output<typeof rateInput>) {
  const d = await db();
  const [row] = await d.insert(exchangeRates).values({ zigPerUsd: input.zigPerUsd.toFixed(4), source: input.source, setBy: actor.id }).returning({ id: exchangeRates.id });
  await audit(actor, { action: 'billing.rate_set', entity: 'exchange_rate', entityId: row.id, details: { zigPerUsd: input.zigPerUsd, source: input.source } });
  return row;
}

export async function rateHistory(limit = 30) {
  const d = await db();
  return d.select({ id: exchangeRates.id, zigPerUsd: exchangeRates.zigPerUsd, source: exchangeRates.source, effectiveAt: exchangeRates.effectiveAt, setBy: user.name })
    .from(exchangeRates).leftJoin(user, eq(user.id, exchangeRates.setBy)).orderBy(desc(exchangeRates.effectiveAt)).limit(limit);
}

// ───────── Invoices ─────────

export async function getOrCreateInvoiceForVisit(actor: A, visitId: string) {
  const d = await db();
  const [existing] = await d.select({ id: invoices.id }).from(invoices).where(eq(invoices.visitId, visitId));
  if (existing) return existing;
  const [v] = await d.select({ v: visits, p: patients }).from(visits).innerJoin(patients, eq(patients.id, visits.patientId)).where(eq(visits.id, visitId));
  if (!v) throw notFound('Visit');
  const aid = v.v.payerType === 'medical_aid';
  if (aid && !v.p.medicalAidId) throw new HttpError(400, 'The visit is marked medical aid but the patient has no medical aid on file');
  const [row] = await d.insert(invoices).values({
    invoiceNo: await nextNumber('invoice', 'INV-'), visitId, patientId: v.p.id, payerType: v.v.payerType,
    medicalAidId: aid ? v.p.medicalAidId : null, memberNo: aid ? v.p.maMemberNo : null, dependantCode: aid ? v.p.maDependantCode : null,
    createdBy: actor.id,
  }).returning({ id: invoices.id });
  await audit(actor, { action: 'billing.invoice_create', entity: 'invoice', entityId: row.id, patientId: v.p.id });
  return row;
}

// Diagnosis codes only (no clinical narrative) so front desk can code aid claims
async function visitDiagnosisCodes(visitId: string | null) {
  if (!visitId) return [];
  const d = await db();
  return d.select({ code: diagnoses.code, description: diagnoses.description, isPrimary: diagnoses.isPrimary })
    .from(diagnoses).innerJoin(consultations, eq(consultations.id, diagnoses.consultationId))
    .where(eq(consultations.visitId, visitId)).orderBy(desc(diagnoses.isPrimary));
}

export async function getInvoice(id: string) {
  const d = await db();
  const [row] = await d.select({ i: invoices, p: patients, aidName: medicalAids.name, aidEmail: medicalAids.claimsEmail })
    .from(invoices).innerJoin(patients, eq(patients.id, invoices.patientId)).leftJoin(medicalAids, eq(medicalAids.id, invoices.medicalAidId))
    .where(eq(invoices.id, id));
  if (!row) throw notFound('Invoice');
  const [items, pays, dx] = await Promise.all([
    d.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id)).orderBy(asc(invoiceItems.code)),
    d.select({ p: payments, by: user.name }).from(payments).leftJoin(user, eq(user.id, payments.receivedBy)).where(eq(payments.invoiceId, id)).orderBy(asc(payments.receivedAt)),
    visitDiagnosisCodes(row.i.visitId),
  ]);
  const patientPaid = pays.filter((x) => x.p.method !== 'medical_aid').reduce((s, x) => s + x.p.usdCents, 0);
  return {
    ...row.i,
    patient: { id: row.p.id, firstName: row.p.firstName, lastName: row.p.lastName, fileNo: row.p.fileNo, dob: row.p.dob, phone: row.p.phone, address: row.p.address, city: row.p.city, maPrincipalName: row.p.maPrincipalName },
    medicalAidName: row.aidName,
    items,
    payments: pays.map((x) => ({ ...x.p, receivedByName: x.by })),
    diagnosisCodes: dx,
    balanceCents: Math.max(0, row.i.patientCents - patientPaid),
  };
}

export async function setInvoiceItems(actor: A, invoiceId: string, input: z.output<typeof invoiceItemsInput>) {
  const d = await db();
  const [inv] = await d.select().from(invoices).where(eq(invoices.id, invoiceId));
  if (!inv) throw notFound('Invoice');
  // D4: once money has been taken (or the claim is in a batch) the invoice is locked
  if (inv.status !== 'open' || inv.paidCents > 0) throw new HttpError(400, 'This invoice has payments and can no longer be edited');
  if (!['none', 'pending'].includes(inv.claimStatus)) throw new HttpError(400, 'This invoice is part of a claim batch');
  const aid = inv.payerType === 'medical_aid';

  const tariffIds = input.items.map((i) => i.tariffId).filter((x): x is string => !!x);
  const tRows = tariffIds.length ? await d.select().from(tariffs).where(inArray(tariffs.id, tariffIds)) : [];
  const overrides = tariffIds.length && inv.medicalAidId
    ? await d.select().from(tariffAidRates).where(and(inArray(tariffAidRates.tariffId, tariffIds), eq(tariffAidRates.medicalAidId, inv.medicalAidId)))
    : [];

  const lines = input.items.map((i) => {
    const t = i.tariffId ? tRows.find((x) => x.id === i.tariffId) : undefined;
    if (i.tariffId && !t) throw new HttpError(400, 'Unknown tariff');
    if (!t && i.unitPrice === undefined) throw new HttpError(400, `Enter a price for "${i.description}"`);
    if (aid && !i.icd10) throw new HttpError(400, `ICD-10 code required on every line of a medical aid invoice ("${i.description}")`);
    const unitCents = t ? t.cashCents : toCents(i.unitPrice!);
    const aidUnitCents = t ? (overrides.find((o) => o.tariffId === t.id)?.aidCents ?? t.aidCents) : 0;
    return { tariffId: t?.id ?? null, code: t?.code ?? i.code ?? null, description: t?.description ?? i.description, icd10: i.icd10, qty: i.qty, unitCents, aidUnitCents };
  });
  const priced = priceLines(lines, inv.payerType);

  await d.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
  if (priced.lines.length) await d.insert(invoiceItems).values(priced.lines.map((l) => ({ ...l, invoiceId })));
  await d.update(invoices).set({
    totalCents: priced.totalCents, aidCents: priced.aidCents, patientCents: priced.patientCents,
    claimStatus: aid && priced.aidCents > 0 ? 'pending' : 'none',
  }).where(eq(invoices.id, invoiceId));
  await audit(actor, { action: 'billing.invoice_items', entity: 'invoice', entityId: invoiceId, patientId: inv.patientId,
    details: { lines: lines.length, total: priced.totalCents, aid: priced.aidCents } });
  return { totalCents: priced.totalCents, aidCents: priced.aidCents, patientCents: priced.patientCents };
}

const CASH_METHODS = ['usd_cash', 'zig_cash'];

export async function recordPayment(actor: A, invoiceId: string, input: z.output<typeof paymentInput>) {
  const d = await db();
  const [inv] = await d.select().from(invoices).where(eq(invoices.id, invoiceId));
  if (!inv) throw notFound('Invoice');
  if (inv.status === 'void') throw new HttpError(400, 'This invoice is void');
  if (inv.totalCents === 0) throw new HttpError(400, 'Add items to the invoice before taking payment');
  const balance = inv.patientCents - inv.paidCents;
  if (balance <= 0) throw new HttpError(400, 'Nothing is owing on this invoice');

  const needsRate = input.tenders.some((t) => t.currency === 'ZiG');
  const rate = needsRate ? await currentRate() : null;
  if (needsRate && !rate) throw new HttpError(400, 'Set today\'s exchange rate before accepting ZiG');

  const tenders = input.tenders.map((t) => {
    const amountMinor = toCents(t.amount);
    const usdCents = t.currency === 'USD' ? amountMinor : zigToUsdCents(amountMinor, rate!.zigPerUsd);
    return { ...t, amountMinor, usdCents };
  });
  const tendered = tenders.reduce((s, t) => s + t.usdCents, 0);
  let change: { currency: 'USD' | 'ZiG'; amountMinor: number } | null = null;

  if (tendered > balance) {
    // Overpayment is only possible with cash: give change from the last cash tender
    const excess = tendered - balance;
    const cashIdx = tenders.map((t) => CASH_METHODS.includes(t.method)).lastIndexOf(true);
    if (cashIdx < 0 || tenders[cashIdx].usdCents < excess) throw new HttpError(400, 'Card, mobile money and transfer payments cannot exceed the amount owing');
    const cash = tenders[cashIdx];
    // Work out what the cash tender must cover in its own currency, so change is exact
    // (converting the USD excess back to ZiG would round twice and short-change the patient)
    const neededUsd = balance - (tendered - cash.usdCents);
    const neededMinor = cash.currency === 'USD' ? neededUsd : usdToZigCents(neededUsd, rate!.zigPerUsd);
    change = { currency: cash.currency, amountMinor: cash.amountMinor - neededMinor };
    cash.amountMinor = neededMinor;
    cash.usdCents = neededUsd;
  }

  const receiptNo = await nextNumber('receipt', 'RCT-');
  const now = new Date();
  await d.insert(payments).values(tenders.filter((t) => t.amountMinor > 0).map((t) => ({
    receiptNo, invoiceId, patientId: inv.patientId, method: t.method, currency: t.currency, amountMinor: t.amountMinor,
    zigRate: t.currency === 'ZiG' ? rate!.zigPerUsd.toFixed(4) : null, usdCents: t.usdCents, reference: t.reference ?? null,
    receivedBy: actor.id, receivedAt: now,
  })));
  const applied = Math.min(tendered, balance);
  const paidCents = inv.paidCents + applied;
  const status = paidCents >= inv.patientCents ? 'paid' : 'partially_paid';
  await d.update(invoices).set({ paidCents, status }).where(eq(invoices.id, invoiceId));

  // D3: fully paid → visit leaves the billing column
  if (status === 'paid' && inv.visitId) await completeVisit(actor, inv.visitId);
  await audit(actor, { action: 'billing.payment', entity: 'invoice', entityId: invoiceId, patientId: inv.patientId,
    details: { receiptNo, tenders: tenders.map((t) => ({ method: t.method, currency: t.currency, amountMinor: t.amountMinor })), change } });
  return { receiptNo, paidCents, status, change };
}

async function completeVisit(actor: A, visitId: string) {
  const d = await db();
  const res = await d.update(visits).set({ status: 'completed', statusChangedAt: new Date(), completedAt: new Date() })
    .where(and(eq(visits.id, visitId), inArray(visits.status, ['billing', 'triage_done', 'with_doctor', 'with_nurse', 'checked_in']))).returning({ appointmentId: visits.appointmentId });
  if (!res.length) return;
  await d.insert(visitStatusLog).values({ visitId, status: 'completed', userId: actor.id });
  if (res[0].appointmentId) await d.update(appointments).set({ status: 'completed' }).where(eq(appointments.id, res[0].appointmentId));
  emit({ type: 'queue.changed', id: visitId });
}

export async function voidInvoice(actor: A, invoiceId: string, reason: string) {
  const d = await db();
  const [inv] = await d.select().from(invoices).where(eq(invoices.id, invoiceId));
  if (!inv) throw notFound('Invoice');
  if (inv.status === 'void') return { ok: true };
  if (inv.paidCents > 0) throw new HttpError(400, 'Refund the payments before voiding this invoice');
  if (!['none', 'pending'].includes(inv.claimStatus)) throw new HttpError(400, 'This invoice is part of a claim batch');
  await d.update(invoices).set({ status: 'void', voidReason: reason, claimStatus: 'none' }).where(eq(invoices.id, invoiceId));
  await audit(actor, { action: 'billing.invoice_void', entity: 'invoice', entityId: invoiceId, patientId: inv.patientId, details: { reason } });
  return { ok: true };
}

export async function listInvoices(day: string, status?: string) {
  const d = await db();
  const [start, end] = dayBounds(day);
  return d.select({
    id: invoices.id, invoiceNo: invoices.invoiceNo, createdAt: invoices.createdAt, payerType: invoices.payerType, status: invoices.status,
    claimStatus: invoices.claimStatus, totalCents: invoices.totalCents, aidCents: invoices.aidCents, patientCents: invoices.patientCents,
    paidCents: invoices.paidCents, firstName: patients.firstName, lastName: patients.lastName, fileNo: patients.fileNo, aid: medicalAids.name,
  }).from(invoices).innerJoin(patients, eq(patients.id, invoices.patientId)).leftJoin(medicalAids, eq(medicalAids.id, invoices.medicalAidId))
    .where(and(gte(invoices.createdAt, start), lt(invoices.createdAt, end), status ? eq(invoices.status, status as never) : undefined))
    .orderBy(desc(invoices.createdAt));
}

// Visits waiting at the billing desk, and older invoices with a balance still owing
export async function billingWorklist() {
  const d = await db();
  const awaiting = await d.select({
    visitId: visits.id, checkedInAt: visits.checkedInAt, payerType: visits.payerType, patientId: patients.id,
    firstName: patients.firstName, lastName: patients.lastName, fileNo: patients.fileNo, invoiceId: invoices.id, invoiceStatus: invoices.status,
  }).from(visits).innerJoin(patients, eq(patients.id, visits.patientId)).leftJoin(invoices, eq(invoices.visitId, visits.id))
    .where(eq(visits.status, 'billing')).orderBy(asc(visits.statusChangedAt));
  const owing = await d.select({
    id: invoices.id, invoiceNo: invoices.invoiceNo, createdAt: invoices.createdAt, patientCents: invoices.patientCents, paidCents: invoices.paidCents,
    firstName: patients.firstName, lastName: patients.lastName,
  }).from(invoices).innerJoin(patients, eq(patients.id, invoices.patientId))
    .where(and(inArray(invoices.status, ['open', 'partially_paid']), sql`${invoices.patientCents} > ${invoices.paidCents}`, lt(invoices.createdAt, dayBounds(localDay())[0])))
    .orderBy(asc(invoices.createdAt)).limit(50);
  return { awaiting, owing };
}

// ───────── Cash-up (FEATURES §D, AC D5) ─────────

export async function cashupSummary(day: string, cashierId?: string | null) {
  const d = await db();
  const [start, end] = dayBounds(day);
  const rows = await d.select({
    method: payments.method, currency: payments.currency, cashierId: payments.receivedBy, cashier: user.name,
    amountMinor: sql<number>`sum(${payments.amountMinor})`.mapWith(Number), usdCents: sql<number>`sum(${payments.usdCents})`.mapWith(Number),
    count: sql<number>`count(*)`.mapWith(Number),
  }).from(payments).leftJoin(user, eq(user.id, payments.receivedBy))
    .where(and(gte(payments.receivedAt, start), lt(payments.receivedAt, end), ne(payments.method, 'medical_aid'), cashierId ? eq(payments.receivedBy, cashierId) : undefined))
    .groupBy(payments.method, payments.currency, payments.receivedBy, user.name);
  const byMethod = new Map<string, { method: string; currency: string; amountMinor: number; usdCents: number; count: number }>();
  for (const r of rows) {
    const k = `${r.method}:${r.currency}`;
    const cur = byMethod.get(k) ?? { method: r.method, currency: r.currency, amountMinor: 0, usdCents: 0, count: 0 };
    cur.amountMinor += r.amountMinor; cur.usdCents += r.usdCents; cur.count += r.count;
    byMethod.set(k, cur);
  }
  const lines = [...byMethod.values()].sort((a, b) => a.method.localeCompare(b.method));
  const expectedUsdCash = lines.filter((l) => l.method === 'usd_cash').reduce((s, l) => s + l.amountMinor, 0);
  const expectedZigCash = lines.filter((l) => l.method === 'zig_cash').reduce((s, l) => s + l.amountMinor, 0);
  const cashiers = [...new Map(rows.map((r) => [r.cashierId, r.cashier])).entries()].map(([id, name]) => ({ id, name }));
  const declared = await d.select({ c: cashups, by: user.name }).from(cashups).leftJoin(user, eq(user.id, cashups.createdBy))
    .where(and(eq(cashups.day, day), cashierId ? eq(cashups.cashierId, cashierId) : undefined)).orderBy(desc(cashups.createdAt));
  return {
    day, lines, cashiers,
    totalUsdEquivalent: lines.reduce((s, l) => s + l.usdCents, 0),
    expectedUsdCash, expectedZigCash,
    declarations: declared.map((x) => ({ ...x.c, createdByName: x.by })),
  };
}

export async function declareCashup(actor: A, input: z.output<typeof cashupInput>) {
  const s = await cashupSummary(input.day, input.cashierId);
  const declaredUsdCents = toCents(input.declaredUsd);
  const declaredZigCents = toCents(input.declaredZig);
  const variance = { usd: declaredUsdCents - s.expectedUsdCash, zig: declaredZigCents - s.expectedZigCash };
  const expected = Object.fromEntries(s.lines.map((l) => [`${l.method}:${l.currency}`, l.amountMinor]));
  const [row] = await (await db()).insert(cashups).values({
    day: input.day, cashierId: input.cashierId ?? null, expected, declaredUsdCents, declaredZigCents, variance, notes: input.notes ?? null, createdBy: actor.id,
  }).returning({ id: cashups.id });
  await audit(actor, { action: 'billing.cashup', entity: 'cashup', entityId: row.id, details: { day: input.day, cashierId: input.cashierId, variance } });
  return { id: row.id, variance };
}
