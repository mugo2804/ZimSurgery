import 'server-only';
import { and, desc, eq, ilike, ne, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db, nextNumber } from '../db';
import { appointments, medicalAids, patients, user, visits } from '../db/schema';
import { audit, type Actor } from '../audit';
import { HttpError, notFound } from '../errors';
import { normalizeNationalId, normalizeZimPhone } from '@/lib/validation';
import { patientInput, aidVerification } from '@/lib/schemas';

type Input = z.output<typeof patientInput>;

// A1: phone numbers normalised to 2637XXXXXXXX; invalid ones rejected with a clear field error
function normalise(p: Input) {
  const fields: Record<string, string[]> = {};
  const phone = (key: 'phone' | 'whatsapp' | 'nokPhone') => {
    if (!p[key]) return null;
    const n = normalizeZimPhone(p[key]);
    if (!n) fields[key] = ['Not a valid Zimbabwean phone number (e.g. 0772 123 456)'];
    return n;
  };
  const nationalId = p.nationalId ? normalizeNationalId(p.nationalId) : null;
  if (p.nationalId && !nationalId) fields.nationalId = ['National ID format is NN-NNNNNN X NN (e.g. 63-123456 F 42)'];
  const out = {
    firstName: p.firstName, lastName: p.lastName, dob: p.dob ?? null, sex: p.sex ?? null, nationalId,
    phone: phone('phone'), whatsapp: phone('whatsapp'), email: p.email, address: p.address, city: p.city, occupation: p.occupation,
    nokName: p.nokName, nokPhone: phone('nokPhone'), nokRelation: p.nokRelation,
    medicalAidId: p.medicalAidId, maMemberNo: p.medicalAidId ? p.maMemberNo : null,
    maPrincipalName: p.medicalAidId ? p.maPrincipalName : null, maDependantCode: p.medicalAidId ? p.maDependantCode ?? '00' : null,
    allergyStatus: p.allergyStatus, allergies: p.allergies.map((a) => ({ ...a, reaction: a.reaction ?? undefined })),
    chronicConditions: [...new Set(p.chronicConditions)], recallIntervalMonths: p.recallIntervalMonths,
    commsConsent: p.commsConsent, preferredChannel: p.preferredChannel,
  };
  if (!out.whatsapp && out.phone) out.whatsapp = out.phone;
  if (Object.keys(fields).length) throw new HttpError(400, Object.values(fields)[0][0], fields);
  return out;
}

export type DuplicateMatch = { id: string; fileNo: string; name: string; dob: string | null; nationalId: string | null; reason: string };

// A2: same national ID, or same name + date of birth
export async function findDuplicates(p: { firstName: string; lastName: string; dob?: string | null; nationalId?: string | null }, excludeId?: string): Promise<DuplicateMatch[]> {
  const d = await db();
  const nid = p.nationalId ? normalizeNationalId(p.nationalId) : null;
  const conds: SQL[] = [];
  if (nid) conds.push(eq(patients.nationalId, nid));
  if (p.dob) {
    conds.push(and(ilike(patients.firstName, p.firstName.trim()), ilike(patients.lastName, p.lastName.trim()), eq(patients.dob, p.dob))!);
  }
  if (!conds.length) return [];
  const rows = await d.select().from(patients).where(and(or(...conds), excludeId ? ne(patients.id, excludeId) : undefined)).limit(5);
  return rows.map((r) => ({
    id: r.id, fileNo: r.fileNo, name: `${r.firstName} ${r.lastName}`, dob: r.dob, nationalId: r.nationalId,
    reason: nid && r.nationalId === nid ? 'Same national ID' : 'Same name and date of birth',
  }));
}

export async function createPatient(actor: Actor, input: Input) {
  const d = await db();
  if (input.id) {
    // Offline replay of a registration that already reached us
    const [existing] = await d.select({ id: patients.id, fileNo: patients.fileNo }).from(patients).where(eq(patients.id, input.id));
    if (existing) return existing;
  }
  const values = normalise(input);
  if (!input.confirmDuplicate) {
    const dups = await findDuplicates(values);
    if (dups.length) throw new HttpError(409, 'Possible duplicate patient', undefined, { duplicates: dups });
  }
  const [row] = await d.insert(patients).values({
    ...values, id: input.id, fileNo: await nextNumber('patient', 'ZMP-'), createdBy: actor?.id,
  }).returning({ id: patients.id, fileNo: patients.fileNo });
  await audit(actor, { action: 'patient.create', entity: 'patient', entityId: row.id, patientId: row.id, details: { duplicateOverride: !!input.confirmDuplicate } });
  return row;
}

export async function updatePatient(actor: Actor, id: string, input: Input) {
  const d = await db();
  const [before] = await d.select().from(patients).where(eq(patients.id, id));
  if (!before) throw notFound('Patient');
  const values = normalise(input);
  if (values.nationalId && values.nationalId !== before.nationalId) {
    const dups = (await findDuplicates(values, id)).filter((x) => x.reason === 'Same national ID');
    if (dups.length) throw new HttpError(409, 'Another patient already has this national ID', undefined, { duplicates: dups });
  }
  // Changing the medical aid membership invalidates the previous verification
  const aidChanged = values.medicalAidId !== before.medicalAidId || values.maMemberNo !== before.maMemberNo;
  await d.update(patients).set({ ...values, ...(aidChanged ? { maVerifiedAt: null, maVerifiedBy: null, maVerifiedMethod: null } : {}) }).where(eq(patients.id, id));
  const changed = Object.keys(values).filter((k) => JSON.stringify(values[k as keyof typeof values]) !== JSON.stringify(before[k as keyof typeof before] ?? null));
  // Field names only — values may be sensitive
  await audit(actor, { action: 'patient.update', entity: 'patient', entityId: id, patientId: id, details: { changed } });
  return { id, fileNo: before.fileNo };
}

export async function searchPatients(q: string, limit = 25) {
  const d = await db();
  const s = q.trim();
  let where: SQL | undefined;
  if (s) {
    const like = `%${s.replace(/[%_\\]/g, (c) => '\\' + c)}%`;
    const digits = s.replace(/\D/g, '');
    const phone = normalizeZimPhone(s);
    const conds: SQL[] = [
      ilike(sql`${patients.firstName} || ' ' || ${patients.lastName}`, like),
      ilike(sql`${patients.lastName} || ' ' || ${patients.firstName}`, like),
      ilike(patients.fileNo, like),
      ilike(patients.maMemberNo, like),
    ];
    if (digits.length >= 4) conds.push(ilike(sql`regexp_replace(coalesce(${patients.nationalId}, ''), '[^0-9A-Za-z]', '', 'g')`, `%${s.replace(/[^0-9A-Za-z]/g, '')}%`));
    if (phone) conds.push(eq(patients.phone, phone), eq(patients.whatsapp, phone));
    where = or(...conds);
  }
  return d.select({
    id: patients.id, fileNo: patients.fileNo, firstName: patients.firstName, lastName: patients.lastName, dob: patients.dob, sex: patients.sex,
    nationalId: patients.nationalId, phone: patients.phone, allergyStatus: patients.allergyStatus, allergies: patients.allergies,
    chronicConditions: patients.chronicConditions, medicalAid: medicalAids.name, maMemberNo: patients.maMemberNo, medicalAidId: patients.medicalAidId,
  }).from(patients).leftJoin(medicalAids, eq(medicalAids.id, patients.medicalAidId))
    .where(where).orderBy(s ? patients.lastName : desc(patients.updatedAt), patients.firstName).limit(limit);
}

export async function getPatient(id: string) {
  const d = await db();
  const [row] = await d.select({ p: patients, aidName: medicalAids.name, verifiedByName: user.name })
    .from(patients).leftJoin(medicalAids, eq(medicalAids.id, patients.medicalAidId)).leftJoin(user, eq(user.id, patients.maVerifiedBy))
    .where(eq(patients.id, id));
  if (!row) throw notFound('Patient');
  return { ...row.p, medicalAidName: row.aidName, maVerifiedByName: row.verifiedByName };
}

// A4: every view of a patient record is audited
export async function viewPatient(actor: Actor, id: string, context = 'file') {
  const p = await getPatient(id);
  await audit(actor, { action: 'patient.view', entity: 'patient', entityId: id, patientId: id, details: { context } });
  return p;
}

export async function patientActivity(id: string) {
  const d = await db();
  const [visitRows, apptRows] = await Promise.all([
    d.select({ id: visits.id, status: visits.status, checkedInAt: visits.checkedInAt, payerType: visits.payerType, complaint: visits.complaint, doctor: user.name })
      .from(visits).leftJoin(user, eq(user.id, visits.doctorId)).where(eq(visits.patientId, id)).orderBy(desc(visits.checkedInAt)).limit(50),
    d.select({ id: appointments.id, startAt: appointments.startAt, status: appointments.status, reason: appointments.reason, doctor: user.name })
      .from(appointments).leftJoin(user, eq(user.id, appointments.doctorId)).where(eq(appointments.patientId, id)).orderBy(desc(appointments.startAt)).limit(50),
  ]);
  return { visits: visitRows, appointments: apptRows };
}

export async function verifyMedicalAid(actor: Actor, id: string, input: z.output<typeof aidVerification>) {
  const d = await db();
  const p = await getPatient(id);
  if (!p.medicalAidId) throw new HttpError(400, 'This patient has no medical aid on file');
  await d.update(patients).set({ maVerifiedAt: new Date(), maVerifiedBy: actor?.id, maVerifiedMethod: input.method }).where(eq(patients.id, id));
  await audit(actor, { action: 'patient.aid_verified', entity: 'patient', entityId: id, patientId: id, details: { method: input.method, note: input.note } });
  return { ok: true };
}

export async function listMedicalAids(activeOnly = true) {
  const d = await db();
  return d.select().from(medicalAids).where(activeOnly ? eq(medicalAids.active, true) : undefined).orderBy(medicalAids.name);
}
