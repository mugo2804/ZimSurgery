import 'server-only';
import { and, asc, eq, gte, inArray, lt, notInArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { appointments, medicalAids, patients, user, visits, visitStatusLog, vitals, type VisitStatus } from '../db/schema';
import { audit, type Actor } from '../audit';
import { emit } from '../events';
import { HttpError, notFound } from '../errors';
import { dayBounds, localDay } from '@/lib/time';
import { can, type Role } from '@/lib/rbac';
import { checkInInput } from '@/lib/schemas';

// "Next available" = the active doctor with the fewest patients currently waiting for them
async function nextAvailableDoctor(): Promise<string | null> {
  const d = await db();
  const [start, end] = dayBounds(localDay());
  const rows = await d.select({
    id: user.id,
    load: sql<number>`count(${visits.id}) filter (where ${visits.status} not in ('completed','cancelled','billing'))`.mapWith(Number),
  }).from(user)
    .leftJoin(visits, and(eq(visits.doctorId, user.id), gte(visits.checkedInAt, start), lt(visits.checkedInAt, end)))
    .where(and(eq(user.role, 'doctor'), eq(user.active, true)))
    .groupBy(user.id).orderBy(sql`2`, user.name);
  return rows[0]?.id ?? null;
}

export async function checkIn(actor: Actor, input: z.output<typeof checkInInput>) {
  const d = await db();
  if (input.id) {
    const [existing] = await d.select({ id: visits.id }).from(visits).where(eq(visits.id, input.id));
    if (existing) return existing;
  }
  const [p] = await d.select({ id: patients.id, medicalAidId: patients.medicalAidId }).from(patients).where(eq(patients.id, input.patientId));
  if (!p) throw notFound('Patient');
  if (input.payerType === 'medical_aid' && !p.medicalAidId) throw new HttpError(400, 'This patient has no medical aid on file — update their details or check in as cash');

  const [start, end] = dayBounds(localDay());
  const [active] = await d.select({ id: visits.id }).from(visits).where(and(
    eq(visits.patientId, input.patientId), gte(visits.checkedInAt, start), lt(visits.checkedInAt, end), notInArray(visits.status, ['completed', 'cancelled']),
  ));
  if (active) throw new HttpError(409, 'This patient is already checked in today');

  let doctorId = input.doctorId ?? null;
  if (input.appointmentId) {
    const [a] = await d.select().from(appointments).where(eq(appointments.id, input.appointmentId));
    if (!a || a.patientId !== input.patientId) throw new HttpError(400, 'Appointment does not belong to this patient');
    doctorId ??= a.doctorId;
    await d.update(appointments).set({ status: 'arrived' }).where(eq(appointments.id, a.id));
    emit({ type: 'appointments.changed', id: a.id });
  }
  doctorId ??= await nextAvailableDoctor();

  const now = new Date();
  const [row] = await d.insert(visits).values({
    id: input.id, patientId: input.patientId, doctorId, appointmentId: input.appointmentId ?? null, payerType: input.payerType,
    priority: input.priority, complaint: input.complaint, checkedInAt: now, statusChangedAt: now, createdBy: actor?.id,
  }).returning({ id: visits.id });
  await d.insert(visitStatusLog).values({ visitId: row.id, status: 'checked_in', userId: actor?.id, at: now });
  await audit(actor, { action: 'visit.check_in', entity: 'visit', entityId: row.id, patientId: input.patientId, details: { payerType: input.payerType, priority: input.priority } });
  emit({ type: 'queue.changed', id: row.id });
  return row;
}

// B4: only clinical staff may move a patient into a clinical room
const CLINICAL_STATUSES: VisitStatus[] = ['with_nurse', 'with_doctor'];

export async function setVisitStatus(actor: Actor & { role: Role }, id: string, status: VisitStatus, doctorId?: string) {
  const d = await db();
  const [v] = await d.select().from(visits).where(eq(visits.id, id));
  if (!v) throw notFound('Visit');
  if (CLINICAL_STATUSES.includes(status) && !can(actor.role, 'queue:clinical')) {
    throw new HttpError(403, 'Only nurses and doctors can move patients into a consultation');
  }
  if (v.status === 'cancelled') throw new HttpError(400, 'This visit was cancelled');
  if (v.status === status && !doctorId) return { ok: true };
  const now = new Date();
  await d.update(visits).set({
    status, statusChangedAt: now, ...(doctorId ? { doctorId } : {}),
    completedAt: status === 'completed' ? now : null,
  }).where(eq(visits.id, id));
  if (v.status !== status) await d.insert(visitStatusLog).values({ visitId: id, status, userId: actor?.id, at: now });
  if (status === 'completed' && v.appointmentId) {
    await d.update(appointments).set({ status: 'completed' }).where(eq(appointments.id, v.appointmentId));
  }
  await audit(actor, { action: 'visit.status', entity: 'visit', entityId: id, patientId: v.patientId, details: { from: v.status, to: status } });
  emit({ type: 'queue.changed', id });
  return { ok: true };
}

export type QueueCard = Awaited<ReturnType<typeof queueBoard>>[number];

// Today's board: everything checked in today, plus anything still open from earlier days
export async function queueBoard() {
  const d = await db();
  const [start, end] = dayBounds(localDay());
  const rows = await d.select({
    id: visits.id, status: visits.status, priority: visits.priority, payerType: visits.payerType, complaint: visits.complaint,
    checkedInAt: visits.checkedInAt, statusChangedAt: visits.statusChangedAt, doctorId: visits.doctorId, doctorName: user.name,
    patientId: patients.id, firstName: patients.firstName, lastName: patients.lastName, dob: patients.dob, sex: patients.sex, fileNo: patients.fileNo,
    allergyStatus: patients.allergyStatus, allergies: patients.allergies, chronicConditions: patients.chronicConditions, medicalAid: medicalAids.name,
  }).from(visits)
    .innerJoin(patients, eq(patients.id, visits.patientId))
    .leftJoin(user, eq(user.id, visits.doctorId))
    .leftJoin(medicalAids, eq(medicalAids.id, patients.medicalAidId))
    .where(or(
      and(gte(visits.checkedInAt, start), lt(visits.checkedInAt, end), notInArray(visits.status, ['cancelled'])),
      and(lt(visits.checkedInAt, start), notInArray(visits.status, ['completed', 'cancelled'])),
    ))
    .orderBy(sql`case when ${visits.priority} = 'urgent' then 0 else 1 end`, asc(visits.checkedInAt));

  // Has triage been recorded for each visit? (used for the "vitals done" tick)
  const ids = rows.map((r) => r.id);
  const triaged = ids.length
    ? new Set((await d.selectDistinct({ visitId: vitals.visitId }).from(vitals).where(inArray(vitals.visitId, ids))).map((r) => r.visitId))
    : new Set<string | null>();
  return rows.map((r) => ({ ...r, hasVitals: triaged.has(r.id) }));
}

export async function getVisit(id: string) {
  const d = await db();
  const [v] = await d.select({ v: visits, doctorName: user.name }).from(visits).leftJoin(user, eq(user.id, visits.doctorId)).where(eq(visits.id, id));
  if (!v) throw notFound('Visit');
  return { ...v.v, doctorName: v.doctorName };
}
