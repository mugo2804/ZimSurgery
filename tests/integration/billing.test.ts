import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { getRootDb, withTx } from '@/server/db';
import { medicalAids, payments, tariffs, visits } from '@/server/db/schema';
import { createStaff } from '@/server/services/users';
import { createPatient } from '@/server/services/patients';
import { checkIn } from '@/server/services/visits';
import {
  cashupSummary, declareCashup, getInvoice, getOrCreateInvoiceForVisit, recordPayment, saveTariff, setExchangeRate, setInvoiceItems, voidInvoice,
} from '@/server/services/billing';
import { batchCsv, createBatch, getBatch, recordRemittance, setBatchStatus } from '@/server/services/claims';
import { checkInInput, patientInput } from '@/lib/schemas';
import { cashupInput, paymentInput, tariffInput } from '@/lib/billing-schemas';
import { localDay } from '@/lib/time';

type Actor = { id: string; username: string; role: string };
let cashier: Actor, admin: Actor;
let aidId: string, consultId: string, injId: string;

async function newVisit(payerType: 'cash' | 'medical_aid', name: string) {
  const p = await withTx(() => createPatient(cashier, patientInput.parse({
    firstName: name, lastName: 'Bill', dob: '1975-01-01', allergyStatus: 'nka',
    ...(payerType === 'medical_aid' ? { medicalAidId: aidId, maMemberNo: `M-${name}`, maDependantCode: '01' } : {}),
  })));
  const v = await withTx(() => checkIn(cashier, checkInInput.parse({ patientId: p.id, payerType })));
  await (await getRootDb()).update(visits).set({ status: 'billing' }).where(eq(visits.id, v.id));
  return (await withTx(() => getOrCreateInvoiceForVisit(cashier, v.id))).id;
}

beforeAll(async () => {
  await withTx(async () => {
    cashier = { id: await createStaff({ username: 'cash1', name: 'Cashier One', role: 'reception', password: 'Correct-Horse-9' }), username: 'cash1', role: 'reception' };
    admin = { id: await createStaff({ username: 'adm1', name: 'Admin One', role: 'admin', password: 'Correct-Horse-9' }), username: 'adm1', role: 'admin' };
    await createStaff({ username: 'docx', name: 'Doc X', role: 'doctor', password: 'Correct-Horse-9' });
  });
  const d = await getRootDb();
  aidId = (await d.insert(medicalAids).values({ name: 'TestAid', code: 'TA', claimsEmail: 'claims@testaid.example' }).returning())[0].id;
  consultId = (await withTx(() => saveTariff(admin, null, tariffInput.parse({ code: 'T190', description: 'Consult', category: 'Consultation', cashPrice: 30, aidPrice: 25, aidRates: [{ medicalAidId: aidId, price: 22 }] })))).id!;
  injId = (await d.insert(tariffs).values({ code: 'T201', description: 'Injection', cashCents: 500, aidCents: 400 }).returning())[0].id;
  await withTx(() => setExchangeRate(admin, { zigPerUsd: 26.75, source: 'test' }));
});

describe('invoices (FEATURES §D)', () => {
  it('prices aid invoices with society overrides and requires ICD-10 lines (D1)', async () => {
    const id = await newVisit('medical_aid', 'Aidy');
    await expect(withTx(() => setInvoiceItems(cashier, id, { items: [{ tariffId: consultId, description: 'x', qty: 1, icd10: null }] }))).rejects.toMatchObject({ status: 400 });
    const r = await withTx(() => setInvoiceItems(cashier, id, { items: [{ tariffId: consultId, description: 'x', qty: 1, icd10: 'I10' }, { tariffId: injId, description: 'x', qty: 2, icd10: 'I10' }] }));
    expect(r).toEqual({ totalCents: 4000, aidCents: 2200 + 800, patientCents: 1000 });
    expect((await getInvoice(id)).claimStatus).toBe('pending');
  });

  it('takes split USD + ZiG cash tenders, stores the rate, and gives change (D2, D3)', async () => {
    const id = await newVisit('cash', 'Casha');
    await withTx(() => setInvoiceItems(cashier, id, { items: [{ tariffId: consultId, description: 'x', qty: 1, icd10: null }] }));
    // US$30 owing: US$20 swipe + ZiG 300 cash (= US$11.21) → change in ZiG
    const r = await withTx(() => recordPayment(cashier, id, paymentInput.parse({ tenders: [
      { method: 'swipe', currency: 'USD', amount: 20, reference: 'APP123' },
      { method: 'zig_cash', currency: 'ZiG', amount: 300 },
    ] })));
    expect(r.status).toBe('paid');
    expect(r.change).toEqual({ currency: 'ZiG', amountMinor: 3250 }); // 300 − 267.50
    const rows = await (await getRootDb()).select().from(payments).where(eq(payments.invoiceId, id));
    const zig = rows.find((p) => p.currency === 'ZiG')!;
    expect(zig.amountMinor).toBe(26750);
    expect(Number(zig.zigRate)).toBe(26.75);
    expect(rows.reduce((s, p) => s + p.usdCents, 0)).toBe(3000);
    const [v] = await (await getRootDb()).select().from(visits).innerJoin(payments, eq(payments.invoiceId, id)).limit(1);
    expect(v).toBeTruthy();
  });

  it('refuses non-cash overpayment and locks paid invoices (D4)', async () => {
    const id = await newVisit('cash', 'Locky');
    await withTx(() => setInvoiceItems(cashier, id, { items: [{ tariffId: injId, description: 'x', qty: 1, icd10: null }] }));
    await expect(withTx(() => recordPayment(cashier, id, paymentInput.parse({ tenders: [{ method: 'ecocash', currency: 'USD', amount: 6 }] })))).rejects.toMatchObject({ status: 400 });
    await withTx(() => recordPayment(cashier, id, paymentInput.parse({ tenders: [{ method: 'ecocash', currency: 'USD', amount: 2 }] })));
    expect((await getInvoice(id)).status).toBe('partially_paid');
    await expect(withTx(() => setInvoiceItems(cashier, id, { items: [] }))).rejects.toMatchObject({ status: 400 });
    await expect(withTx(() => voidInvoice(admin, id, 'patient left'))).rejects.toMatchObject({ status: 400 });
  });

  it('voids an unpaid invoice with a reason', async () => {
    const id = await newVisit('cash', 'Voidy');
    await withTx(() => voidInvoice(admin, id, 'Duplicate invoice'));
    expect((await getInvoice(id)).status).toBe('void');
  });

  it('cash-up totals equal the day\'s payments, per cashier (D5)', async () => {
    const s = await cashupSummary(localDay(), cashier.id);
    const all = await (await getRootDb()).select().from(payments);
    const expected = all.filter((p) => p.method !== 'medical_aid' && p.receivedBy === cashier.id).reduce((t, p) => t + p.usdCents, 0);
    expect(s.totalUsdEquivalent).toBe(expected);
    expect(s.expectedZigCash).toBe(26750);
    const r = await withTx(() => declareCashup(cashier, cashupInput.parse({ day: localDay(), cashierId: cashier.id, declaredUsd: 0, declaredZig: 267 })));
    expect(r.variance).toEqual({ usd: 0, zig: -50 });
  });
});

describe('claims', () => {
  it('batches, exports CSV, and posts remittances as aid payments', async () => {
    const a = await newVisit('medical_aid', 'Claimone');
    const b = await newVisit('medical_aid', 'Claimtwo');
    for (const id of [a, b]) await withTx(() => setInvoiceItems(cashier, id, { items: [{ tariffId: consultId, description: 'x', qty: 1, icd10: 'J06.9' }] }));
    const batch = await withTx(() => createBatch(cashier, { medicalAidId: aidId, invoiceIds: [a, b] }));
    await expect(withTx(() => createBatch(cashier, { medicalAidId: aidId, invoiceIds: [a] }))).rejects.toMatchObject({ status: 400 });

    const { csv } = await withTx(() => batchCsv(cashier, batch.id));
    expect(csv.split('\r\n')[0]).toContain('member_no');
    expect(csv).toContain('M-Claimone');
    expect(csv).toContain('J06.9');

    await withTx(() => setBatchStatus(cashier, batch.id, 'submitted'));
    await withTx(() => recordRemittance(cashier, batch.id, { reference: 'EFT1', lines: [
      { invoiceId: a, paid: 22, rejected: false }, { invoiceId: b, paid: 0, rejected: true, note: 'Member suspended' },
    ] }));
    const done = await getBatch(batch.id);
    expect(done.status).toBe('paid');
    expect(done.paidCents).toBe(2200);
    expect((await getInvoice(a)).claimStatus).toBe('paid');
    expect((await getInvoice(b)).claimStatus).toBe('rejected');
    const aidPays = await (await getRootDb()).select().from(payments).where(eq(payments.invoiceId, a));
    expect(aidPays.find((p) => p.method === 'medical_aid')?.usdCents).toBe(2200);
  });
});
