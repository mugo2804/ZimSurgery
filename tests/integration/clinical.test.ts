import { beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { getRootDb, withTx } from '@/server/db';
import { auditLog, consultations, labOrders, referrals, visits } from '@/server/db/schema';
import { createStaff } from '@/server/services/users';
import { createPatient } from '@/server/services/patients';
import { checkIn } from '@/server/services/visits';
import {
  addAddendum, createLabOrder, createPrescription, createReferral, getConsultation, recordVitals, saveConsultation, signConsultation, updateLabOrder,
} from '@/server/services/clinical';
import { isEncrypted } from '@/server/crypto';
import { checkInInput, patientInput } from '@/lib/schemas';
import { consultationInput, labOrderInput, labResultInput, prescriptionInput, referralInput, vitalsInput } from '@/lib/clinical-schemas';

type Actor = { id: string; username: string; role: string };
let doctor: Actor, doctor2: Actor, nurse: Actor, reception: Actor;
let visitId: string;

beforeAll(async () => {
  await withTx(async () => {
    const mk = async (username: string, role: 'doctor' | 'nurse' | 'reception') =>
      ({ id: await createStaff({ username, name: username, role, password: 'Correct-Horse-9', hpzNumber: role === 'doctor' ? 'MDPCZ/1' : null }), username, role });
    doctor = await mk('doc-a', 'doctor');
    doctor2 = await mk('doc-b', 'doctor');
    nurse = await mk('nurse-a', 'nurse');
    reception = await mk('rec-a', 'reception');
  });
  const p = await withTx(() => createPatient(reception, patientInput.parse({
    firstName: 'Allergic', lastName: 'Patient', dob: '1960-01-01', allergyStatus: 'recorded',
    allergies: [{ substance: 'Penicillin', severity: 'anaphylaxis' }],
  })));
  visitId = (await withTx(() => checkIn(reception, checkInInput.parse({ patientId: p.id, payerType: 'cash', doctorId: doctor.id })))).id;
});

describe('triage', () => {
  it('records vitals, computes BMI and moves the visit to triage_done', async () => {
    await withTx(() => recordVitals(nurse, visitId, vitalsInput.parse({ bpSys: 150, bpDia: 95, weightKg: 80, heightCm: 180 })));
    const d = await getRootDb();
    const [v] = await d.select().from(visits).where(eq(visits.id, visitId));
    expect(v.status).toBe('triage_done');
    const data = await withTx(() => getConsultation(doctor, visitId));
    expect(data.vitals[0].bmi).toBe(24.7);
  });

  it('rejects implausible values and systolic ≤ diastolic', () => {
    expect(() => vitalsInput.parse({ bpSys: 1200 })).toThrow();
    expect(() => vitalsInput.parse({ bpSys: 80, bpDia: 90 })).toThrow();
    expect(() => vitalsInput.parse({})).toThrow();
  });
});

describe('consultation (FEATURES §C)', () => {
  it('stores S/O/A/P encrypted at rest (C1)', async () => {
    await withTx(() => saveConsultation(doctor, visitId, consultationInput.parse({
      subjective: 'Headache for 3 days', objective: 'BP 150/95', assessment: 'Uncontrolled HTN', plan: 'Start amlodipine',
      diagnoses: [{ code: 'I10', description: 'Essential (primary) hypertension', isPrimary: true }],
    })));
    const [raw] = await (await getRootDb()).select().from(consultations).where(eq(consultations.visitId, visitId));
    for (const f of [raw.subjective, raw.objective, raw.assessment, raw.plan]) {
      expect(isEncrypted(f)).toBe(true);
      expect(f).not.toContain('Headache');
    }
    const data = await withTx(() => getConsultation(doctor, visitId));
    expect(data.consultation?.subjective).toBe('Headache for 3 days');
    expect(data.diagnoses[0].code).toBe('I10');
  });

  it('only lets the author edit the draft', async () => {
    await expect(withTx(() => saveConsultation(doctor2, visitId, consultationInput.parse({ subjective: 'x' })))).rejects.toMatchObject({ status: 403 });
  });

  it('blocks allergy conflicts without an override reason (C3)', async () => {
    const rx = (reason?: string) => withTx(() => createPrescription(doctor, visitId, prescriptionInput.parse({
      items: [{ medicine: 'Amoxicillin', strength: '500mg', dose: '1 cap', frequency: 'tds' }], allergyOverrideReason: reason,
    })));
    await expect(rx()).rejects.toMatchObject({ status: 400 });
    const ok = await rx('Tolerated amoxicillin in 2024 without reaction');
    expect(ok.rxNo).toMatch(/^RX-\d+$/);
    const [entry] = await (await getRootDb()).select().from(auditLog).where(and(eq(auditLog.entityId, ok.id), eq(auditLog.action, 'clinical.rx_allergy_override')));
    expect(entry).toBeTruthy();
  });

  it('allows non-conflicting prescriptions without a reason', async () => {
    const r = await withTx(() => createPrescription(doctor, visitId, prescriptionInput.parse({ items: [{ medicine: 'Amlodipine', strength: '5mg' }] })));
    expect(r.id).toBeTruthy();
  });

  it('encrypts lab clinical info, results and referral letters (C1)', async () => {
    const lab = await withTx(() => createLabOrder(doctor, visitId, labOrderInput.parse({ lab: 'Lancet Laboratories', tests: ['U&E + Creatinine'], clinicalInfo: 'New HTN, baseline renal' })));
    await withTx(() => updateLabOrder(nurse, lab.id, labResultInput.parse({ status: 'resulted', result: 'Creatinine 88 umol/L' })));
    const ref = await withTx(() => createReferral(doctor, visitId, referralInput.parse({ toSpecialty: 'Cardiology', letter: 'Please assess for secondary causes of hypertension.' })));
    const d = await getRootDb();
    const [l] = await d.select().from(labOrders).where(eq(labOrders.id, lab.id));
    const [r] = await d.select().from(referrals).where(eq(referrals.id, ref.id));
    expect(isEncrypted(l.clinicalInfo)).toBe(true);
    expect(isEncrypted(l.result)).toBe(true);
    expect(isEncrypted(r.letter)).toBe(true);
  });

  it('signs only with a primary diagnosis, then locks the note and sends to billing', async () => {
    await withTx(() => signConsultation(doctor, visitId));
    const [v] = await (await getRootDb()).select().from(visits).where(eq(visits.id, visitId));
    expect(v.status).toBe('billing');
    await expect(withTx(() => saveConsultation(doctor, visitId, consultationInput.parse({ subjective: 'changed' })))).rejects.toMatchObject({ status: 400 });
    await expect(withTx(() => addAddendum(doctor, visitId, { text: 'Patient phoned: headache resolved' }))).resolves.toHaveProperty('id');
    await expect(withTx(() => addAddendum(doctor2, visitId, { text: 'not mine' }))).rejects.toMatchObject({ status: 403 });
  });
});
