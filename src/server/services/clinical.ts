import 'server-only';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, nextNumber } from '../db';
import {
  consultationAddenda, consultations, diagnoses, labOrders, patients, prescriptionItems, prescriptions, procedures, referrals,
  stockItems, stockMovements, user, visits, visitStatusLog, vitals,
} from '../db/schema';
import { audit, type Actor } from '../audit';
import { decrypt, encrypt } from '../crypto';
import { emit } from '../events';
import { HttpError, notFound } from '../errors';
import { bmi } from '@/lib/validation';
import { allergyConflicts } from '@/lib/reference/medicines';
import { addendumInput, consultationInput, labOrderInput, labResultInput, prescriptionInput, procedureInput, referralInput, vitalsInput } from '@/lib/clinical-schemas';

type A = NonNullable<Actor>;

async function loadVisit(visitId: string) {
  const [v] = await (await db()).select().from(visits).where(eq(visits.id, visitId));
  if (!v) throw notFound('Visit');
  if (v.status === 'cancelled') throw new HttpError(400, 'This visit was cancelled');
  return v;
}

async function moveVisit(actor: A, visitId: string, from: string[], to: 'triage_done' | 'with_doctor' | 'billing') {
  const d = await db();
  const res = await d.update(visits).set({ status: to, statusChangedAt: new Date() })
    .where(and(eq(visits.id, visitId), inArray(visits.status, from as never[]))).returning({ id: visits.id });
  if (res.length) {
    await d.insert(visitStatusLog).values({ visitId, status: to, userId: actor.id });
    emit({ type: 'queue.changed', id: visitId });
  }
}

// ───────── Triage (nurse) ─────────

export async function recordVitals(actor: A, visitId: string, input: z.output<typeof vitalsInput>) {
  const d = await db();
  if (input.id) {
    const [dup] = await d.select({ id: vitals.id }).from(vitals).where(eq(vitals.id, input.id));
    if (dup) return dup;
  }
  const v = await loadVisit(visitId);
  const { id, ...values } = input;
  const [row] = await d.insert(vitals).values({
    ...values, id, visitId, patientId: v.patientId, bmi: bmi(values.weightKg, values.heightCm), recordedBy: actor.id,
  }).returning({ id: vitals.id });
  // Saving triage pushes the patient into the doctor's view (FEATURES §C)
  await moveVisit(actor, visitId, ['checked_in', 'with_nurse'], 'triage_done');
  await audit(actor, { action: 'clinical.vitals', entity: 'vitals', entityId: row.id, patientId: v.patientId });
  return row;
}

export async function recordProcedure(actor: A, visitId: string, input: z.output<typeof procedureInput>) {
  const d = await db();
  if (input.id) {
    const [dup] = await d.select({ id: procedures.id }).from(procedures).where(eq(procedures.id, input.id));
    if (dup) return dup;
  }
  const v = await loadVisit(visitId);
  const { id, deductStock, ...values } = input;
  if (values.stockItemId && deductStock) {
    const [item] = await d.select().from(stockItems).where(eq(stockItems.id, values.stockItemId));
    if (!item) throw notFound('Stock item');
    if (item.qty < 1) throw new HttpError(400, `${item.name} is out of stock`);
    await d.update(stockItems).set({ qty: sql`${stockItems.qty} - 1` }).where(eq(stockItems.id, item.id));
    await d.insert(stockMovements).values({ itemId: item.id, change: -1, reason: 'issue', note: `Given: ${values.item}`, visitId, userId: actor.id });
    values.batchNo ??= item.batchNo;
  }
  const [row] = await d.insert(procedures).values({ ...values, id, visitId, patientId: v.patientId, givenBy: actor.id }).returning({ id: procedures.id });
  await audit(actor, { action: 'clinical.procedure', entity: 'procedure', entityId: row.id, patientId: v.patientId, details: { item: values.item } });
  return row;
}

// ───────── Consultation (doctor) ─────────

function decryptConsultation(c: typeof consultations.$inferSelect) {
  return { ...c, subjective: decrypt(c.subjective), objective: decrypt(c.objective), assessment: decrypt(c.assessment), plan: decrypt(c.plan) };
}

async function ensureConsultation(actor: A, visitId: string) {
  const d = await db();
  const [existing] = await d.select().from(consultations).where(eq(consultations.visitId, visitId));
  if (existing) return existing;
  const v = await loadVisit(visitId);
  const [created] = await d.insert(consultations).values({ visitId, patientId: v.patientId, doctorId: actor.id }).returning();
  await d.update(visits).set({ doctorId: actor.id }).where(eq(visits.id, visitId));
  await moveVisit(actor, visitId, ['checked_in', 'triage_done', 'with_nurse'], 'with_doctor');
  return created;
}

function assertAuthor(actor: A, c: { doctorId: string; status: string }, allowSigned = false) {
  if (c.doctorId !== actor.id) throw new HttpError(403, 'Only the doctor who wrote this consultation can change it');
  if (!allowSigned && c.status === 'signed') throw new HttpError(400, 'This consultation is signed — add an addendum instead');
}

export async function getConsultation(actor: A, visitId: string) {
  const d = await db();
  const v = await loadVisit(visitId);
  const [c] = await d.select().from(consultations).where(eq(consultations.visitId, visitId));
  const [dx, rx, labs, refs, addenda, vit, procs] = c
    ? await Promise.all([
      d.select().from(diagnoses).where(eq(diagnoses.consultationId, c.id)).orderBy(desc(diagnoses.isPrimary)),
      prescriptionsFor(c.id),
      d.select().from(labOrders).where(eq(labOrders.consultationId, c.id)).orderBy(desc(labOrders.createdAt)),
      d.select({ id: referrals.id, refNo: referrals.refNo, toName: referrals.toName, toSpecialty: referrals.toSpecialty, createdAt: referrals.createdAt })
        .from(referrals).where(eq(referrals.consultationId, c.id)),
      d.select({ a: consultationAddenda, author: user.name }).from(consultationAddenda).innerJoin(user, eq(user.id, consultationAddenda.authorId))
        .where(eq(consultationAddenda.consultationId, c.id)).orderBy(consultationAddenda.createdAt),
      d.select().from(vitals).where(eq(vitals.visitId, visitId)).orderBy(desc(vitals.recordedAt)),
      d.select().from(procedures).where(eq(procedures.visitId, visitId)).orderBy(desc(procedures.givenAt)),
    ])
    : [[], [], [], [], [], await d.select().from(vitals).where(eq(vitals.visitId, visitId)).orderBy(desc(vitals.recordedAt)),
      await d.select().from(procedures).where(eq(procedures.visitId, visitId)).orderBy(desc(procedures.givenAt))];
  if (c) await audit(actor, { action: 'clinical.view', entity: 'consultation', entityId: c.id, patientId: v.patientId });
  const [doctor] = c ? await d.select({ name: user.name }).from(user).where(eq(user.id, c.doctorId)) : [];
  return {
    visit: v,
    consultation: c ? { ...decryptConsultation(c), doctorName: doctor?.name ?? null } : null,
    diagnoses: dx,
    prescriptions: rx,
    labOrders: labs.map((l) => ({ ...l, clinicalInfo: decrypt(l.clinicalInfo), result: decrypt(l.result) })),
    referrals: refs,
    addenda: addenda.map((x) => ({ ...x.a, text: decrypt(x.a.text), author: x.author })),
    vitals: vit,
    procedures: procs,
  };
}

export async function saveConsultation(actor: A, visitId: string, input: z.output<typeof consultationInput>) {
  const d = await db();
  const c = await ensureConsultation(actor, visitId);
  assertAuthor(actor, c);
  await d.update(consultations).set({
    subjective: encrypt(input.subjective), objective: encrypt(input.objective), assessment: encrypt(input.assessment), plan: encrypt(input.plan),
    followUpDate: input.followUpDate ?? null,
  }).where(eq(consultations.id, c.id));
  if (input.diagnoses) {
    await d.delete(diagnoses).where(eq(diagnoses.consultationId, c.id));
    const primaryIdx = Math.max(0, input.diagnoses.findIndex((x) => x.isPrimary));
    if (input.diagnoses.length) {
      await d.insert(diagnoses).values(input.diagnoses.map((x, i) => ({
        consultationId: c.id, patientId: c.patientId, code: x.code, description: x.description, isPrimary: i === primaryIdx,
      })));
    }
  }
  // Drafts autosave frequently, so only the first save and diagnosis changes are audited individually
  await audit(actor, { action: 'clinical.consult_save', entity: 'consultation', entityId: c.id, patientId: c.patientId, details: { diagnoses: input.diagnoses?.map((x) => x.code) } });
  return { id: c.id, savedAt: new Date().toISOString() };
}

export async function signConsultation(actor: A, visitId: string) {
  const d = await db();
  const [c] = await d.select().from(consultations).where(eq(consultations.visitId, visitId));
  if (!c) throw notFound('Consultation');
  assertAuthor(actor, c);
  const [primary] = await d.select({ id: diagnoses.id }).from(diagnoses).where(and(eq(diagnoses.consultationId, c.id), eq(diagnoses.isPrimary, true)));
  if (!primary) throw new HttpError(400, 'Add a primary diagnosis (ICD-10) before signing');
  if (!decrypt(c.subjective).trim() && !decrypt(c.assessment).trim()) throw new HttpError(400, 'Record at least the history or assessment before signing');
  await d.update(consultations).set({ status: 'signed', signedAt: new Date() }).where(eq(consultations.id, c.id));
  await moveVisit(actor, visitId, ['checked_in', 'triage_done', 'with_nurse', 'with_doctor'], 'billing');
  await audit(actor, { action: 'clinical.consult_sign', entity: 'consultation', entityId: c.id, patientId: c.patientId });
  return { ok: true, followUpDate: c.followUpDate, patientId: c.patientId };
}

export async function addAddendum(actor: A, visitId: string, input: z.output<typeof addendumInput>) {
  const d = await db();
  const [c] = await d.select().from(consultations).where(eq(consultations.visitId, visitId));
  if (!c) throw notFound('Consultation');
  assertAuthor(actor, c, true);
  if (c.status !== 'signed') throw new HttpError(400, 'Edit the draft directly — addenda are for signed notes');
  const [row] = await d.insert(consultationAddenda).values({ consultationId: c.id, authorId: actor.id, text: encrypt(input.text)! }).returning({ id: consultationAddenda.id });
  await audit(actor, { action: 'clinical.addendum', entity: 'consultation', entityId: c.id, patientId: c.patientId });
  return row;
}

// ───────── Prescriptions ─────────

async function prescriptionsFor(consultationId: string) {
  const d = await db();
  const rx = await d.select().from(prescriptions).where(eq(prescriptions.consultationId, consultationId)).orderBy(desc(prescriptions.createdAt));
  const items = rx.length ? await d.select().from(prescriptionItems).where(inArray(prescriptionItems.prescriptionId, rx.map((r) => r.id))) : [];
  return rx.map((r) => ({ ...r, items: items.filter((i) => i.prescriptionId === r.id) }));
}

export async function createPrescription(actor: A, visitId: string, input: z.output<typeof prescriptionInput>) {
  const d = await db();
  const c = await ensureConsultation(actor, visitId);
  assertAuthor(actor, c, true);
  const [p] = await d.select({ allergies: patients.allergies, allergyStatus: patients.allergyStatus }).from(patients).where(eq(patients.id, c.patientId));
  // C3: allergy conflicts cannot be saved without an override reason
  const conflicts = input.items.flatMap((i) => allergyConflicts(i.medicine, p.allergies).map((a) => `${i.medicine} ↔ ${a}`));
  if (conflicts.length && !input.allergyOverrideReason) {
    throw new HttpError(400, `Allergy conflict: ${conflicts.join('; ')}. Enter a reason to override.`, undefined, { allergyConflicts: conflicts });
  }
  const rxNo = await nextNumber('rx', 'RX-');
  const [rx] = await d.insert(prescriptions).values({
    rxNo, consultationId: c.id, visitId, patientId: c.patientId, doctorId: actor.id, notes: input.notes,
    allergyOverrideReason: conflicts.length ? input.allergyOverrideReason : null,
  }).returning({ id: prescriptions.id, rxNo: prescriptions.rxNo });
  await d.insert(prescriptionItems).values(input.items.map((i) => ({ ...i, prescriptionId: rx.id })));
  await audit(actor, { action: conflicts.length ? 'clinical.rx_allergy_override' : 'clinical.rx_create', entity: 'prescription', entityId: rx.id, patientId: c.patientId,
    details: conflicts.length ? { conflicts, reason: input.allergyOverrideReason } : { items: input.items.length } });
  return rx;
}

// ───────── Labs & referrals ─────────

export async function createLabOrder(actor: A, visitId: string, input: z.output<typeof labOrderInput>) {
  const d = await db();
  const c = await ensureConsultation(actor, visitId);
  assertAuthor(actor, c, true);
  const [row] = await d.insert(labOrders).values({
    orderNo: await nextNumber('lab', 'LAB-'), consultationId: c.id, visitId, patientId: c.patientId, doctorId: actor.id,
    lab: input.lab, tests: input.tests, clinicalInfo: encrypt(input.clinicalInfo), urgency: input.urgency,
  }).returning({ id: labOrders.id, orderNo: labOrders.orderNo });
  await audit(actor, { action: 'clinical.lab_order', entity: 'lab_order', entityId: row.id, patientId: c.patientId, details: { lab: input.lab, tests: input.tests.length } });
  return row;
}

export async function updateLabOrder(actor: A, id: string, input: z.output<typeof labResultInput>) {
  const d = await db();
  const [o] = await d.select().from(labOrders).where(eq(labOrders.id, id));
  if (!o) throw notFound('Lab order');
  if (o.status === 'resulted' && input.status !== 'resulted') throw new HttpError(400, 'Results are already recorded');
  if (input.status === 'resulted' && !input.result?.trim()) throw new HttpError(400, 'Enter the result');
  await d.update(labOrders).set({
    status: input.status,
    ...(input.status === 'resulted' ? { result: encrypt(input.result), resultedAt: new Date(), resultedBy: actor.id } : {}),
  }).where(eq(labOrders.id, id));
  await audit(actor, { action: `clinical.lab_${input.status}`, entity: 'lab_order', entityId: id, patientId: o.patientId });
  return { ok: true, patientId: o.patientId };
}

export async function outstandingLabs() {
  const d = await db();
  return d.select({
    id: labOrders.id, orderNo: labOrders.orderNo, lab: labOrders.lab, tests: labOrders.tests, urgency: labOrders.urgency, status: labOrders.status,
    createdAt: labOrders.createdAt, patientId: patients.id, firstName: patients.firstName, lastName: patients.lastName, fileNo: patients.fileNo, doctor: user.name,
  }).from(labOrders).innerJoin(patients, eq(patients.id, labOrders.patientId)).innerJoin(user, eq(user.id, labOrders.doctorId))
    .where(inArray(labOrders.status, ['ordered', 'sample_taken'])).orderBy(desc(labOrders.urgency), labOrders.createdAt);
}

export async function createReferral(actor: A, visitId: string, input: z.output<typeof referralInput>) {
  const d = await db();
  const c = await ensureConsultation(actor, visitId);
  assertAuthor(actor, c, true);
  const [row] = await d.insert(referrals).values({
    refNo: await nextNumber('ref', 'REF-'), consultationId: c.id, patientId: c.patientId, doctorId: actor.id,
    toName: input.toName, toSpecialty: input.toSpecialty, toFacility: input.toFacility, urgency: input.urgency, letter: encrypt(input.letter),
  }).returning({ id: referrals.id, refNo: referrals.refNo });
  await audit(actor, { action: 'clinical.referral', entity: 'referral', entityId: row.id, patientId: c.patientId });
  return row;
}

// ───────── History sidebar ─────────

export async function clinicalHistory(patientId: string, excludeVisitId?: string) {
  const d = await db();
  const since = new Date(Date.now() - 180 * 86_400_000);
  const [dx, meds, vit, labs, consults] = await Promise.all([
    d.select({ code: diagnoses.code, description: diagnoses.description, createdAt: diagnoses.createdAt }).from(diagnoses)
      .where(eq(diagnoses.patientId, patientId)).orderBy(desc(diagnoses.createdAt)).limit(15),
    d.select({ medicine: prescriptionItems.medicine, strength: prescriptionItems.strength, frequency: prescriptionItems.frequency, createdAt: prescriptions.createdAt })
      .from(prescriptionItems).innerJoin(prescriptions, eq(prescriptions.id, prescriptionItems.prescriptionId))
      .where(and(eq(prescriptions.patientId, patientId), gte(prescriptions.createdAt, since))).orderBy(desc(prescriptions.createdAt)).limit(20),
    d.select().from(vitals).where(eq(vitals.patientId, patientId)).orderBy(desc(vitals.recordedAt)).limit(6),
    d.select({ id: labOrders.id, orderNo: labOrders.orderNo, tests: labOrders.tests, status: labOrders.status, createdAt: labOrders.createdAt, result: labOrders.result })
      .from(labOrders).where(eq(labOrders.patientId, patientId)).orderBy(desc(labOrders.createdAt)).limit(10),
    d.select({ visitId: consultations.visitId, signedAt: consultations.signedAt, createdAt: consultations.createdAt, status: consultations.status, doctor: user.name })
      .from(consultations).innerJoin(user, eq(user.id, consultations.doctorId)).where(eq(consultations.patientId, patientId))
      .orderBy(desc(consultations.createdAt)).limit(20),
  ]);
  // Distinct diagnosis codes, newest first
  const seen = new Set<string>();
  const uniqueDx = dx.filter((x) => (seen.has(x.code) ? false : (seen.add(x.code), true)));
  return {
    diagnoses: uniqueDx,
    medicines: meds,
    vitals: vit,
    labs: labs.map((l) => ({ ...l, result: decrypt(l.result) })),
    consultations: consults.filter((c) => c.visitId !== excludeVisitId),
  };
}

// ───────── Printing ─────────

export async function prescriptionForPrint(actor: A, id: string) {
  const d = await db();
  const [rx] = await d.select().from(prescriptions).where(eq(prescriptions.id, id));
  if (!rx) throw notFound('Prescription');
  const items = await d.select().from(prescriptionItems).where(eq(prescriptionItems.prescriptionId, id));
  const [doctor] = await d.select().from(user).where(eq(user.id, rx.doctorId));
  await audit(actor, { action: 'clinical.rx_print', entity: 'prescription', entityId: id, patientId: rx.patientId });
  return { rx, items, doctor };
}

export async function labOrderForPrint(actor: A, id: string) {
  const d = await db();
  const [o] = await d.select().from(labOrders).where(eq(labOrders.id, id));
  if (!o) throw notFound('Lab order');
  const [doctor] = await d.select().from(user).where(eq(user.id, o.doctorId));
  await audit(actor, { action: 'clinical.lab_print', entity: 'lab_order', entityId: id, patientId: o.patientId });
  return { order: { ...o, clinicalInfo: decrypt(o.clinicalInfo), result: decrypt(o.result) }, doctor };
}

export async function referralForPrint(actor: A, id: string) {
  const d = await db();
  const [r] = await d.select().from(referrals).where(eq(referrals.id, id));
  if (!r) throw notFound('Referral');
  const [doctor] = await d.select().from(user).where(eq(user.id, r.doctorId));
  await audit(actor, { action: 'clinical.referral_print', entity: 'referral', entityId: id, patientId: r.patientId });
  return { referral: { ...r, letter: decrypt(r.letter) }, doctor };
}
