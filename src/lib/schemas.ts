import { z } from 'zod';

// Request schemas shared by API routes (enforcement) and forms (early feedback).

const text = (max = 200) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const SEVERITIES = ['mild', 'moderate', 'severe', 'anaphylaxis'] as const;

export const allergySchema = z.object({
  substance: z.string().trim().min(1, 'Substance is required').max(100),
  reaction: text(200),
  severity: z.enum(SEVERITIES),
});

export const patientInput = z.object({
  id: z.uuid().optional(), // client-generated when registered offline
  firstName: z.string().trim().min(1, 'First name is required').max(80),
  lastName: z.string().trim().min(1, 'Surname is required').max(80),
  // Forms send '' for blank fields; treat that as "not provided"
  dob: z.union([z.literal(''), day]).optional().nullable().transform((v) => v || null)
    .refine((v) => !v || new Date(v) <= new Date(), 'Date of birth is in the future'),
  sex: z.union([z.literal(''), z.enum(['M', 'F', 'O'])]).optional().nullable().transform((v) => v || null),
  nationalId: text(30),
  phone: text(30),
  whatsapp: text(30),
  email: z.email().optional().nullable().or(z.literal('')).transform((v) => v || null),
  address: text(300),
  city: text(80),
  occupation: text(80),
  nokName: text(120),
  nokPhone: text(30),
  nokRelation: text(40),
  medicalAidId: z.uuid().optional().nullable().or(z.literal('')).transform((v) => v || null),
  maMemberNo: text(40),
  maPrincipalName: text(120),
  maDependantCode: z.string().trim().regex(/^\d{2}$/, 'Dependant code is 2 digits, e.g. 00 or 01').optional().nullable().or(z.literal('')).transform((v) => v || null),
  allergyStatus: z.enum(['unknown', 'nka', 'recorded']).default('unknown'),
  allergies: z.array(allergySchema).max(30).default([]),
  chronicConditions: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  recallIntervalMonths: z.coerce.number().int().min(0).max(24).default(0),
  commsConsent: z.boolean().default(true),
  preferredChannel: z.enum(['whatsapp', 'sms']).default('whatsapp'),
  confirmDuplicate: z.boolean().optional(),
}).superRefine((p, ctx) => {
  if (p.medicalAidId && !p.maMemberNo) ctx.addIssue({ code: 'custom', path: ['maMemberNo'], message: 'Membership number is required for medical aid patients' });
  if (p.allergyStatus === 'recorded' && p.allergies.length === 0) ctx.addIssue({ code: 'custom', path: ['allergies'], message: 'Add at least one allergy, or choose "No known allergies"' });
  if (p.allergyStatus !== 'recorded' && p.allergies.length > 0) ctx.addIssue({ code: 'custom', path: ['allergyStatus'], message: 'Allergies are listed — set status to "Allergies recorded"' });
});
export type PatientInput = z.input<typeof patientInput>;

export const aidVerification = z.object({
  method: z.enum(['phone', 'portal', 'card_swipe', 'email']),
  note: text(300),
});

export const appointmentInput = z.object({
  id: z.uuid().optional(),
  patientId: z.uuid(),
  doctorId: z.string().min(1).nullable().optional(),
  day,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM'),
  durationMin: z.coerce.number().int().min(5).max(240).default(15),
  reason: text(300),
  force: z.boolean().optional(),
});

export const appointmentAction = z.discriminatedUnion('action', [
  z.object({ action: z.literal('reschedule'), day, time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), doctorId: z.string().min(1).nullable().optional(), durationMin: z.coerce.number().int().min(5).max(240).optional(), force: z.boolean().optional() }),
  z.object({ action: z.literal('confirm') }),
  z.object({ action: z.literal('cancel'), reason: text(200) }),
  z.object({ action: z.literal('dna') }),
]);

export const checkInInput = z.object({
  id: z.uuid().optional(),
  patientId: z.uuid(),
  appointmentId: z.uuid().optional().nullable(),
  doctorId: z.string().min(1).optional().nullable(), // null = next available doctor
  payerType: z.enum(['cash', 'medical_aid']),
  priority: z.enum(['normal', 'urgent']).default('normal'),
  complaint: text(300),
});

export const QUEUE_COLUMNS = ['checked_in', 'triage_done', 'with_nurse', 'with_doctor', 'billing', 'completed'] as const;
export const visitStatusInput = z.object({ status: z.enum([...QUEUE_COLUMNS, 'cancelled']), doctorId: z.string().min(1).optional() });

export const QUEUE_LABELS: Record<string, string> = {
  checked_in: 'Checked in',
  triage_done: 'Triage done',
  with_nurse: 'With nurse',
  with_doctor: 'With doctor',
  billing: 'Billing',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
