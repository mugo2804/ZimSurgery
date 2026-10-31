import 'server-only';
import { and, asc, eq, gte, lt, ne, notInArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { appointments, patients, user } from '../db/schema';
import { audit, type Actor } from '../audit';
import { emit } from '../events';
import { HttpError, notFound } from '../errors';
import { dayBounds, localDateTime, fmtTime } from '@/lib/time';
import { appointmentInput, appointmentAction } from '@/lib/schemas';
import { onAppointmentBooked } from './engagement-hooks';

export async function listDoctors() {
  const d = await db();
  return d.select({ id: user.id, name: user.name, title: user.title }).from(user)
    .where(and(eq(user.role, 'doctor'), eq(user.active, true))).orderBy(user.name);
}

export async function listAppointments(day: string) {
  const d = await db();
  const [start, end] = dayBounds(day);
  return d.select({
    id: appointments.id, startAt: appointments.startAt, durationMin: appointments.durationMin, reason: appointments.reason,
    status: appointments.status, doctorId: appointments.doctorId, patientId: appointments.patientId,
    firstName: patients.firstName, lastName: patients.lastName, fileNo: patients.fileNo, phone: patients.phone,
    allergyStatus: patients.allergyStatus, medicalAidId: patients.medicalAidId, reminderSentAt: appointments.reminderSentAt,
  }).from(appointments).innerJoin(patients, eq(patients.id, appointments.patientId))
    .where(and(gte(appointments.startAt, start), lt(appointments.startAt, end))).orderBy(asc(appointments.startAt));
}

// Overlapping, still-active bookings for the same doctor
async function overlaps(doctorId: string | null | undefined, startAt: Date, durationMin: number, excludeId?: string) {
  if (!doctorId) return [];
  const d = await db();
  const end = new Date(startAt.getTime() + durationMin * 60_000);
  const sameDay = await d.select({ id: appointments.id, startAt: appointments.startAt, durationMin: appointments.durationMin, firstName: patients.firstName, lastName: patients.lastName })
    .from(appointments).innerJoin(patients, eq(patients.id, appointments.patientId))
    .where(and(
      eq(appointments.doctorId, doctorId),
      notInArray(appointments.status, ['cancelled', 'dna']),
      gte(appointments.startAt, new Date(startAt.getTime() - 4 * 3600_000)),
      lt(appointments.startAt, end),
      excludeId ? ne(appointments.id, excludeId) : undefined,
    ));
  return sameDay.filter((a) => a.startAt.getTime() + a.durationMin * 60_000 > startAt.getTime());
}

function overlapError(clashes: Awaited<ReturnType<typeof overlaps>>) {
  const list = clashes.map((c) => `${fmtTime(c.startAt)} ${c.firstName} ${c.lastName}`).join(', ');
  return new HttpError(409, `This doctor already has a booking at that time (${list}). Book anyway?`, undefined, { overlap: true });
}

export async function bookAppointment(actor: Actor, input: z.output<typeof appointmentInput>) {
  const d = await db();
  if (input.id) {
    const [existing] = await d.select({ id: appointments.id }).from(appointments).where(eq(appointments.id, input.id));
    if (existing) return existing;
  }
  const [p] = await d.select({ id: patients.id }).from(patients).where(eq(patients.id, input.patientId));
  if (!p) throw notFound('Patient');
  const startAt = localDateTime(input.day, input.time);
  if (!input.force) {
    const clashes = await overlaps(input.doctorId, startAt, input.durationMin);
    if (clashes.length) throw overlapError(clashes);
  }
  const [row] = await d.insert(appointments).values({
    id: input.id, patientId: input.patientId, doctorId: input.doctorId ?? null, startAt, durationMin: input.durationMin,
    reason: input.reason, createdBy: actor?.id,
  }).returning({ id: appointments.id });
  await audit(actor, { action: 'appointment.book', entity: 'appointment', entityId: row.id, patientId: input.patientId, details: { overlapOverride: !!input.force } });
  emit({ type: 'appointments.changed', id: row.id });
  await onAppointmentBooked(row.id);
  return row;
}

export async function actOnAppointment(actor: Actor, id: string, input: z.output<typeof appointmentAction>) {
  const d = await db();
  const [a] = await d.select().from(appointments).where(eq(appointments.id, id));
  if (!a) throw notFound('Appointment');
  if (['completed', 'cancelled'].includes(a.status) && input.action !== 'reschedule') throw new HttpError(400, `Appointment is already ${a.status}`);

  switch (input.action) {
    case 'reschedule': {
      if (a.status === 'arrived' || a.status === 'completed') throw new HttpError(400, 'The patient has already arrived for this appointment');
      const startAt = localDateTime(input.day, input.time);
      const doctorId = input.doctorId === undefined ? a.doctorId : input.doctorId;
      const durationMin = input.durationMin ?? a.durationMin;
      if (!input.force) {
        const clashes = await overlaps(doctorId, startAt, durationMin, id);
        if (clashes.length) throw overlapError(clashes);
      }
      // A new time needs a new reminder
      await d.update(appointments).set({ startAt, doctorId, durationMin, status: 'booked', reminderSentAt: null, confirmationSentAt: null }).where(eq(appointments.id, id));
      break;
    }
    case 'confirm':
      await d.update(appointments).set({ status: 'confirmed' }).where(eq(appointments.id, id));
      break;
    case 'cancel':
      await d.update(appointments).set({ status: 'cancelled' }).where(eq(appointments.id, id));
      break;
    case 'dna':
      // B3: DNA only once the appointment time has passed
      if (a.startAt.getTime() > Date.now()) throw new HttpError(400, 'An appointment can only be marked "did not attend" after its start time');
      if (a.status === 'arrived') throw new HttpError(400, 'The patient has arrived for this appointment');
      await d.update(appointments).set({ status: 'dna' }).where(eq(appointments.id, id));
      break;
  }
  await audit(actor, { action: `appointment.${input.action}`, entity: 'appointment', entityId: id, patientId: a.patientId,
    details: input.action === 'cancel' ? { reason: input.reason } : undefined });
  emit({ type: 'appointments.changed', id });
  if (input.action === 'reschedule') await onAppointmentBooked(id);
  return { ok: true };
}
