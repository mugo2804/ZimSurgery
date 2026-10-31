import { z } from 'zod';
import { LABS } from './reference/clinical';

const text = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
const num = (min: number, max: number, int = true) => {
  const base = int ? z.coerce.number().int() : z.coerce.number();
  return z.union([z.literal(''), z.null(), base.min(min).max(max)]).optional().transform((v) => (v === '' || v == null ? null : v));
};

// Physiologically plausible bounds — catch typos (e.g. 1200 instead of 120), not clinical judgement
export const vitalsInput = z.object({
  id: z.uuid().optional(),
  bpSys: num(40, 300),
  bpDia: num(20, 200),
  pulse: num(20, 250),
  respRate: num(4, 80),
  tempC: num(30, 45, false),
  spo2: num(50, 100),
  weightKg: num(0.5, 350, false),
  heightCm: num(30, 250, false),
  glucose: num(0.5, 50, false),
  painScore: num(0, 10),
  notes: text(500),
}).refine((v) => v.bpSys == null || v.bpDia == null || v.bpSys > v.bpDia, { message: 'Systolic must be higher than diastolic', path: ['bpSys'] })
  .refine((v) => Object.entries(v).some(([k, x]) => k !== 'id' && k !== 'notes' && x != null), { message: 'Record at least one measurement' });

export const procedureInput = z.object({
  id: z.uuid().optional(),
  item: z.string().trim().min(1).max(150),
  dose: text(60),
  route: text(30),
  site: text(60),
  batchNo: text(60),
  notes: text(300),
  stockItemId: z.uuid().optional().nullable(),
  deductStock: z.boolean().default(false),
});

export const diagnosisInput = z.object({
  code: z.string().trim().min(1).max(10),
  description: z.string().trim().min(1).max(200),
  isPrimary: z.boolean().default(false),
});

export const consultationInput = z.object({
  subjective: z.string().max(20_000).default(''),
  objective: z.string().max(20_000).default(''),
  assessment: z.string().max(20_000).default(''),
  plan: z.string().max(20_000).default(''),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal('')).transform((v) => v || null),
  diagnoses: z.array(diagnosisInput).max(10).optional(),
});

export const prescriptionItemInput = z.object({
  medicine: z.string().trim().min(1).max(150),
  strength: text(60),
  form: text(40),
  dose: text(60),
  frequency: text(80),
  duration: text(40),
  quantity: text(40),
  instructions: text(200),
});

export const prescriptionInput = z.object({
  items: z.array(prescriptionItemInput).min(1, 'Add at least one medicine').max(15),
  notes: text(500),
  allergyOverrideReason: text(300),
});

export const labOrderInput = z.object({
  lab: z.enum(LABS),
  tests: z.array(z.string().trim().min(1).max(80)).min(1, 'Choose at least one test').max(30),
  clinicalInfo: z.string().max(2000).optional().default(''),
  urgency: z.enum(['routine', 'urgent']).default('routine'),
});

export const labResultInput = z.object({
  status: z.enum(['sample_taken', 'resulted', 'cancelled']),
  result: z.string().max(10_000).optional(),
});

export const referralInput = z.object({
  toName: text(120),
  toSpecialty: z.string().trim().min(1, 'Specialty is required').max(80),
  toFacility: text(150),
  urgency: z.enum(['routine', 'urgent']).default('routine'),
  letter: z.string().trim().min(20, 'The referral letter is too short').max(10_000),
});

export const addendumInput = z.object({ text: z.string().trim().min(1).max(5000) });
