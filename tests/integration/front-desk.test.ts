import { beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { getRootDb, withTx } from '@/server/db';
import { auditLog, patients } from '@/server/db/schema';
import { createStaff } from '@/server/services/users';
import { createPatient, findDuplicates, viewPatient } from '@/server/services/patients';
import { checkIn, setVisitStatus } from '@/server/services/visits';
import { actOnAppointment, bookAppointment } from '@/server/services/appointments';
import { patientInput, appointmentInput, checkInInput } from '@/lib/schemas';
import { localDay } from '@/lib/time';

let reception: { id: string; username: string; role: 'reception' };
let nurse: { id: string; username: string; role: 'nurse' };
let doctorId: string;

beforeAll(async () => {
  await withTx(async () => {
    reception = { id: await createStaff({ username: 'rc1', name: 'Reception One', role: 'reception', password: 'Correct-Horse-9' }), username: 'rc1', role: 'reception' };
    nurse = { id: await createStaff({ username: 'nu1', name: 'Nurse One', role: 'nurse', password: 'Correct-Horse-9' }), username: 'nu1', role: 'nurse' };
    doctorId = await createStaff({ username: 'dr1', name: 'Doctor One', role: 'doctor', password: 'Correct-Horse-9' });
  });
});

const register = (over: Record<string, unknown> = {}) =>
  withTx(() => createPatient(reception, patientInput.parse({ firstName: 'Chipo', lastName: 'Ndlovu', dob: '1985-05-05', phone: '0772 000 111', allergyStatus: 'nka', ...over })));

describe('patient registration (FEATURES §A)', () => {
  it('normalises phone and national ID (A1)', async () => {
    const { id } = await register({ nationalId: '63-1112223 H 63' });
    const [p] = await (await getRootDb()).select().from(patients).where(eq(patients.id, id));
    expect(p.phone).toBe('263772000111');
    expect(p.whatsapp).toBe('263772000111');
    expect(p.nationalId).toBe('63-1112223 H 63');
    expect(p.fileNo).toMatch(/^ZMP-\d{6}$/);
  });

  it('rejects invalid phone numbers (A1)', async () => {
    await expect(register({ firstName: 'X', phone: '0792 1' })).rejects.toThrow(/valid Zimbabwean phone/);
  });

  it('warns on duplicates unless confirmed (A2)', async () => {
    await expect(register()).rejects.toMatchObject({ status: 409 });
    expect((await findDuplicates({ firstName: 'chipo', lastName: 'NDLOVU', dob: '1985-05-05' })).length).toBe(1);
    await expect(register({ confirmDuplicate: true })).resolves.toHaveProperty('id');
  });

  it('is idempotent for offline replays with a client id', async () => {
    const id = crypto.randomUUID();
    const a = await register({ id, firstName: 'Offline', dob: '2001-01-01' });
    const b = await register({ id, firstName: 'Offline', dob: '2001-01-01' });
    expect(a.id).toBe(id);
    expect(b.id).toBe(id);
  });

  it('requires allergies to be listed when status is recorded', () => {
    expect(() => patientInput.parse({ firstName: 'A', lastName: 'B', allergyStatus: 'recorded', allergies: [] })).toThrow();
  });

  it('audits every patient view (A4)', async () => {
    const { id } = await register({ firstName: 'Viewed', dob: '1970-02-02' });
    await withTx(() => viewPatient(reception, id, 'file'));
    const rows = await (await getRootDb()).select().from(auditLog).where(and(eq(auditLog.patientId, id), eq(auditLog.action, 'patient.view')));
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(reception.id);
  });
});

describe('queue & appointments (FEATURES §B)', () => {
  it('checks in once per day and blocks reception from clinical rooms (B4)', async () => {
    const { id: patientId } = await register({ firstName: 'Queue', dob: '1999-09-09' });
    const v = await withTx(() => checkIn(reception, checkInInput.parse({ patientId, payerType: 'cash' })));
    await expect(withTx(() => checkIn(reception, checkInInput.parse({ patientId, payerType: 'cash' })))).rejects.toMatchObject({ status: 409 });
    await expect(withTx(() => setVisitStatus(reception, v.id, 'with_doctor'))).rejects.toMatchObject({ status: 403 });
    await expect(withTx(() => setVisitStatus(nurse, v.id, 'with_nurse'))).resolves.toEqual({ ok: true });
    await expect(withTx(() => setVisitStatus(reception, v.id, 'billing'))).resolves.toEqual({ ok: true });
  });

  it('refuses medical aid check-in for a cash patient', async () => {
    const { id: patientId } = await register({ firstName: 'Cash', dob: '1990-03-03' });
    await expect(withTx(() => checkIn(reception, checkInInput.parse({ patientId, payerType: 'medical_aid' })))).rejects.toMatchObject({ status: 400 });
  });

  it('warns on double-booking and only allows DNA after start time (B3)', async () => {
    const { id: patientId } = await register({ firstName: 'Booker', dob: '1980-04-04' });
    const book = (time: string, force = false, day = '2031-02-03') =>
      withTx(() => bookAppointment(reception, appointmentInput.parse({ patientId, doctorId, day, time, durationMin: 30, force })));
    const a = await book('09:00');
    await expect(book('09:15')).rejects.toMatchObject({ status: 409 });
    await expect(book('09:30')).resolves.toHaveProperty('id'); // back-to-back is fine
    await expect(book('09:15', true)).resolves.toHaveProperty('id');
    await expect(withTx(() => actOnAppointment(reception, a.id, { action: 'dna' }))).rejects.toMatchObject({ status: 400 });
    const past = await book('07:00', true, '2020-01-01');
    await expect(withTx(() => actOnAppointment(reception, past.id, { action: 'dna' }))).resolves.toEqual({ ok: true });
  });

  it('assigns the next available doctor for walk-ins', async () => {
    const { id: patientId } = await register({ firstName: 'Walkin', dob: '1977-07-07' });
    const v = await withTx(() => checkIn(reception, checkInInput.parse({ patientId, payerType: 'cash' })));
    const { getVisit } = await import('@/server/services/visits');
    expect((await getVisit(v.id)).doctorId).toBe(doctorId);
    expect(localDay()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('blank form fields', () => {
  it('treats empty date of birth and sex as not provided', () => {
    const p = patientInput.parse({ firstName: 'No', lastName: 'Dob', dob: '', sex: '' });
    expect(p.dob).toBeNull();
    expect(p.sex).toBeNull();
    expect(() => patientInput.parse({ firstName: 'No', lastName: 'Dob', dob: 'garbage' })).toThrow();
  });
});
