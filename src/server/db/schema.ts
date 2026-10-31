import {
  pgTable, text, timestamp, boolean, integer, uuid, jsonb, numeric, real, bigserial, date, index, uniqueIndex, primaryKey,
} from 'drizzle-orm/pg-core';

// Column names are mapped to snake_case by `casing: 'snake_case'` (drizzle.config.ts and db/index.ts).
// Money is integer cents. ⚿ marks columns holding AES-256-GCM ciphertext (see server/crypto.ts).

const created = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updated = () => timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date());
const at = () => timestamp({ withTimezone: true });

export type Role = 'admin' | 'doctor' | 'nurse' | 'reception';

// ───────────────────────── Better Auth ─────────────────────────

export const user = pgTable('user', {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  username: text().unique(),
  displayUsername: text(),
  twoFactorEnabled: boolean().default(false),
  role: text().$type<Role>().notNull().default('reception'),
  title: text(),
  qualification: text(),
  hpzNumber: text(),
  phone: text(),
  active: boolean().notNull().default(true),
  createdAt: created(),
  updatedAt: updated(),
});

export const session = pgTable('session', {
  id: text().primaryKey(),
  expiresAt: at().notNull(),
  token: text().notNull().unique(),
  ipAddress: text(),
  userAgent: text(),
  userId: text().notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index().on(t.userId)]);

export const account = pgTable('account', {
  id: text().primaryKey(),
  accountId: text().notNull(),
  providerId: text().notNull(),
  userId: text().notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text(),
  refreshToken: text(),
  idToken: text(),
  accessTokenExpiresAt: at(),
  refreshTokenExpiresAt: at(),
  scope: text(),
  password: text(),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index().on(t.userId)]);

export const verification = pgTable('verification', {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: at().notNull(),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index().on(t.identifier)]);

export const twoFactor = pgTable('two_factor', {
  id: text().primaryKey(),
  secret: text().notNull(),
  backupCodes: text().notNull(),
  userId: text().notNull().references(() => user.id, { onDelete: 'cascade' }),
  verified: boolean().default(true),
  failedVerificationCount: integer().default(0),
  lockedUntil: at(),
}, (t) => [index().on(t.userId), index().on(t.secret)]);

// ───────────────────────── Practice configuration ─────────────────────────

export const settings = pgTable('settings', {
  key: text().primaryKey(),
  value: text(),
});

export const sequences = pgTable('sequences', {
  name: text().primaryKey(),
  value: integer().notNull().default(0),
});

export const medicalAids = pgTable('medical_aids', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
  code: text(),
  claimsEmail: text(),
  phone: text(),
  active: boolean().notNull().default(true),
});

// ───────────────────────── Patients & scheduling ─────────────────────────

export type Allergy = { substance: string; reaction?: string; severity: 'mild' | 'moderate' | 'severe' | 'anaphylaxis' };

export const patients = pgTable('patients', {
  id: uuid().primaryKey().defaultRandom(),
  fileNo: text().notNull().unique(),
  firstName: text().notNull(),
  lastName: text().notNull(),
  dob: date(),
  sex: text().$type<'M' | 'F' | 'O'>(),
  nationalId: text(),
  phone: text(),
  whatsapp: text(),
  email: text(),
  address: text(),
  city: text(),
  occupation: text(),
  nokName: text(),
  nokPhone: text(),
  nokRelation: text(),
  medicalAidId: uuid().references(() => medicalAids.id),
  maMemberNo: text(),
  maPrincipalName: text(),
  maDependantCode: text(),
  maVerifiedAt: at(),
  maVerifiedBy: text().references(() => user.id),
  maVerifiedMethod: text(),
  allergyStatus: text().$type<'unknown' | 'nka' | 'recorded'>().notNull().default('unknown'),
  allergies: jsonb().$type<Allergy[]>().notNull().default([]),
  chronicConditions: jsonb().$type<string[]>().notNull().default([]),
  recallIntervalMonths: integer().notNull().default(0),
  lastRecallAt: at(),
  commsConsent: boolean().notNull().default(true),
  preferredChannel: text().$type<'whatsapp' | 'sms'>().notNull().default('whatsapp'),
  createdBy: text().references(() => user.id),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [
  index().on(t.lastName, t.firstName),
  index().on(t.nationalId),
  index().on(t.phone),
  index().on(t.maMemberNo),
]);

export type AppointmentStatus = 'booked' | 'confirmed' | 'arrived' | 'completed' | 'cancelled' | 'dna';

export const appointments = pgTable('appointments', {
  id: uuid().primaryKey().defaultRandom(),
  patientId: uuid().notNull().references(() => patients.id),
  doctorId: text().references(() => user.id),
  startAt: at().notNull(),
  durationMin: integer().notNull().default(15),
  reason: text(),
  status: text().$type<AppointmentStatus>().notNull().default('booked'),
  confirmationSentAt: at(),
  reminderSentAt: at(),
  createdBy: text().references(() => user.id),
  createdAt: created(),
}, (t) => [index().on(t.startAt), index().on(t.patientId)]);

export const VISIT_STATUSES = ['checked_in', 'triage_done', 'with_nurse', 'with_doctor', 'billing', 'completed', 'cancelled'] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const visits = pgTable('visits', {
  id: uuid().primaryKey().defaultRandom(),
  patientId: uuid().notNull().references(() => patients.id),
  doctorId: text().references(() => user.id),
  appointmentId: uuid().references(() => appointments.id),
  status: text().$type<VisitStatus>().notNull().default('checked_in'),
  priority: text().$type<'normal' | 'urgent'>().notNull().default('normal'),
  payerType: text().$type<'cash' | 'medical_aid'>().notNull().default('cash'),
  complaint: text(),
  checkedInAt: at().notNull().defaultNow(),
  statusChangedAt: at().notNull().defaultNow(),
  completedAt: at(),
  createdBy: text().references(() => user.id),
}, (t) => [index().on(t.checkedInAt), index().on(t.patientId)]);

export const visitStatusLog = pgTable('visit_status_log', {
  id: uuid().primaryKey().defaultRandom(),
  visitId: uuid().notNull().references(() => visits.id),
  status: text().$type<VisitStatus>().notNull(),
  userId: text().references(() => user.id),
  at: at().notNull().defaultNow(),
}, (t) => [index().on(t.visitId)]);

// ───────────────────────── Clinical ─────────────────────────

export const vitals = pgTable('vitals', {
  id: uuid().primaryKey().defaultRandom(),
  visitId: uuid().references(() => visits.id),
  patientId: uuid().notNull().references(() => patients.id),
  bpSys: integer(),
  bpDia: integer(),
  pulse: integer(),
  respRate: integer(),
  tempC: real(),
  spo2: integer(),
  weightKg: real(),
  heightCm: real(),
  bmi: real(),
  glucose: real(),
  painScore: integer(),
  notes: text(),
  recordedBy: text().references(() => user.id),
  recordedAt: at().notNull().defaultNow(),
}, (t) => [index().on(t.patientId, t.recordedAt)]);

export const stockItems = pgTable('stock_items', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  category: text(),
  unit: text(),
  qty: integer().notNull().default(0),
  reorderLevel: integer().notNull().default(0),
  batchNo: text(),
  expiryDate: date(),
  costCents: integer(),
  active: boolean().notNull().default(true),
});

export const procedures = pgTable('procedures', {
  id: uuid().primaryKey().defaultRandom(),
  visitId: uuid().references(() => visits.id),
  patientId: uuid().notNull().references(() => patients.id),
  item: text().notNull(),
  dose: text(),
  route: text(),
  site: text(),
  batchNo: text(),
  stockItemId: uuid().references(() => stockItems.id),
  notes: text(),
  givenBy: text().references(() => user.id),
  givenAt: at().notNull().defaultNow(),
}, (t) => [index().on(t.patientId)]);

export const consultations = pgTable('consultations', {
  id: uuid().primaryKey().defaultRandom(),
  visitId: uuid().notNull().unique().references(() => visits.id),
  patientId: uuid().notNull().references(() => patients.id),
  doctorId: text().notNull().references(() => user.id),
  subjective: text(), // ⚿
  objective: text(), // ⚿
  assessment: text(), // ⚿
  plan: text(), // ⚿
  followUpDate: date(),
  status: text().$type<'draft' | 'signed'>().notNull().default('draft'),
  signedAt: at(),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index().on(t.patientId)]);

export const consultationAddenda = pgTable('consultation_addenda', {
  id: uuid().primaryKey().defaultRandom(),
  consultationId: uuid().notNull().references(() => consultations.id),
  authorId: text().notNull().references(() => user.id),
  text: text().notNull(), // ⚿
  createdAt: created(),
});

export const diagnoses = pgTable('diagnoses', {
  id: uuid().primaryKey().defaultRandom(),
  consultationId: uuid().notNull().references(() => consultations.id),
  patientId: uuid().notNull().references(() => patients.id),
  code: text().notNull(),
  description: text().notNull(),
  isPrimary: boolean().notNull().default(false),
  createdAt: created(),
}, (t) => [index().on(t.code), index().on(t.patientId)]);

export const prescriptions = pgTable('prescriptions', {
  id: uuid().primaryKey().defaultRandom(),
  rxNo: text().notNull().unique(),
  consultationId: uuid().references(() => consultations.id),
  visitId: uuid().references(() => visits.id),
  patientId: uuid().notNull().references(() => patients.id),
  doctorId: text().notNull().references(() => user.id),
  notes: text(),
  allergyOverrideReason: text(),
  createdAt: created(),
}, (t) => [index().on(t.patientId)]);

export const prescriptionItems = pgTable('prescription_items', {
  id: uuid().primaryKey().defaultRandom(),
  prescriptionId: uuid().notNull().references(() => prescriptions.id),
  medicine: text().notNull(),
  strength: text(),
  form: text(),
  dose: text(),
  frequency: text(),
  duration: text(),
  quantity: text(),
  instructions: text(),
});

export const labOrders = pgTable('lab_orders', {
  id: uuid().primaryKey().defaultRandom(),
  orderNo: text().notNull().unique(),
  consultationId: uuid().references(() => consultations.id),
  visitId: uuid().references(() => visits.id),
  patientId: uuid().notNull().references(() => patients.id),
  doctorId: text().notNull().references(() => user.id),
  lab: text().notNull(),
  tests: jsonb().$type<string[]>().notNull().default([]),
  clinicalInfo: text(), // ⚿
  urgency: text().$type<'routine' | 'urgent'>().notNull().default('routine'),
  status: text().$type<'ordered' | 'sample_taken' | 'resulted' | 'cancelled'>().notNull().default('ordered'),
  result: text(), // ⚿
  resultedAt: at(),
  resultedBy: text().references(() => user.id),
  createdAt: created(),
}, (t) => [index().on(t.patientId), index().on(t.status)]);

export const referrals = pgTable('referrals', {
  id: uuid().primaryKey().defaultRandom(),
  refNo: text().notNull().unique(),
  consultationId: uuid().references(() => consultations.id),
  patientId: uuid().notNull().references(() => patients.id),
  doctorId: text().notNull().references(() => user.id),
  toName: text(),
  toSpecialty: text(),
  toFacility: text(),
  urgency: text().$type<'routine' | 'urgent'>().notNull().default('routine'),
  letter: text(), // ⚿
  createdAt: created(),
});

// ───────────────────────── Billing ─────────────────────────

export const tariffs = pgTable('tariffs', {
  id: uuid().primaryKey().defaultRandom(),
  code: text().notNull().unique(),
  description: text().notNull(),
  category: text(),
  cashCents: integer().notNull().default(0),
  aidCents: integer().notNull().default(0),
  active: boolean().notNull().default(true),
});

export const tariffAidRates = pgTable('tariff_aid_rates', {
  tariffId: uuid().notNull().references(() => tariffs.id),
  medicalAidId: uuid().notNull().references(() => medicalAids.id),
  aidCents: integer().notNull(),
}, (t) => [primaryKey({ columns: [t.tariffId, t.medicalAidId] })]);

export const exchangeRates = pgTable('exchange_rates', {
  id: uuid().primaryKey().defaultRandom(),
  zigPerUsd: numeric({ precision: 12, scale: 4 }).notNull(),
  source: text(),
  effectiveAt: at().notNull().defaultNow(),
  setBy: text().references(() => user.id),
});

export type InvoiceStatus = 'open' | 'partially_paid' | 'paid' | 'void';
export type ClaimStatus = 'none' | 'pending' | 'batched' | 'submitted' | 'paid' | 'rejected';

export const invoices = pgTable('invoices', {
  id: uuid().primaryKey().defaultRandom(),
  invoiceNo: text().notNull().unique(),
  visitId: uuid().references(() => visits.id),
  patientId: uuid().notNull().references(() => patients.id),
  payerType: text().$type<'cash' | 'medical_aid'>().notNull(),
  medicalAidId: uuid().references(() => medicalAids.id),
  memberNo: text(),
  dependantCode: text(),
  totalCents: integer().notNull().default(0),
  aidCents: integer().notNull().default(0),
  patientCents: integer().notNull().default(0),
  paidCents: integer().notNull().default(0),
  status: text().$type<InvoiceStatus>().notNull().default('open'),
  claimStatus: text().$type<ClaimStatus>().notNull().default('none'),
  claimBatchId: uuid(),
  claimPaidCents: integer().notNull().default(0),
  claimNote: text(),
  voidReason: text(),
  createdBy: text().references(() => user.id),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index().on(t.createdAt), index().on(t.patientId), uniqueIndex().on(t.visitId)]);

export const invoiceItems = pgTable('invoice_items', {
  id: uuid().primaryKey().defaultRandom(),
  invoiceId: uuid().notNull().references(() => invoices.id),
  tariffId: uuid().references(() => tariffs.id),
  code: text(),
  description: text().notNull(),
  icd10: text(),
  qty: integer().notNull().default(1),
  unitCents: integer().notNull(),
  aidUnitCents: integer().notNull().default(0),
  totalCents: integer().notNull(),
  aidTotalCents: integer().notNull().default(0),
}, (t) => [index().on(t.invoiceId)]);

export const PAYMENT_METHODS = ['usd_cash', 'zig_cash', 'swipe', 'ecocash', 'innbucks', 'bank_transfer', 'medical_aid'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const payments = pgTable('payments', {
  id: uuid().primaryKey().defaultRandom(),
  receiptNo: text().notNull(),
  invoiceId: uuid().notNull().references(() => invoices.id),
  patientId: uuid().notNull().references(() => patients.id),
  method: text().$type<PaymentMethod>().notNull(),
  currency: text().$type<'USD' | 'ZiG'>().notNull(),
  amountMinor: integer().notNull(), // cents in `currency`
  zigRate: numeric({ precision: 12, scale: 4 }),
  usdCents: integer().notNull(),
  reference: text(),
  receivedBy: text().references(() => user.id),
  receivedAt: at().notNull().defaultNow(),
}, (t) => [index().on(t.receivedAt), index().on(t.invoiceId)]);

export const cashups = pgTable('cashups', {
  id: uuid().primaryKey().defaultRandom(),
  day: date().notNull(),
  cashierId: text().references(() => user.id),
  expected: jsonb().$type<Record<string, number>>().notNull(),
  declaredUsdCents: integer().notNull().default(0),
  declaredZigCents: integer().notNull().default(0),
  variance: jsonb().$type<{ usd: number; zig: number }>().notNull(),
  notes: text(),
  createdBy: text().references(() => user.id),
  createdAt: created(),
});

export const claimBatches = pgTable('claim_batches', {
  id: uuid().primaryKey().defaultRandom(),
  batchNo: text().notNull().unique(),
  medicalAidId: uuid().notNull().references(() => medicalAids.id),
  status: text().$type<'draft' | 'submitted' | 'paid' | 'rejected'>().notNull().default('draft'),
  totalCents: integer().notNull().default(0),
  paidCents: integer().notNull().default(0),
  notes: text(),
  createdBy: text().references(() => user.id),
  createdAt: created(),
  emailedAt: at(),
  submittedAt: at(),
  paidAt: at(),
});

// ───────────────────────── Stock, messaging, audit ─────────────────────────

export const stockMovements = pgTable('stock_movements', {
  id: uuid().primaryKey().defaultRandom(),
  itemId: uuid().notNull().references(() => stockItems.id),
  change: integer().notNull(),
  reason: text().$type<'receive' | 'issue' | 'adjust' | 'expire'>().notNull(),
  note: text(),
  visitId: uuid(),
  userId: text().references(() => user.id),
  at: at().notNull().defaultNow(),
}, (t) => [index().on(t.itemId)]);

export type MessageKind = 'confirmation' | 'reminder' | 'recall' | 'result' | 'general';

export const messages = pgTable('messages', {
  id: uuid().primaryKey().defaultRandom(),
  patientId: uuid().references(() => patients.id),
  appointmentId: uuid(),
  channel: text().$type<'whatsapp' | 'sms'>().notNull(),
  toNumber: text(),
  kind: text().$type<MessageKind>().notNull(),
  body: text().notNull(),
  status: text().$type<'queued' | 'sent' | 'manual' | 'logged' | 'failed'>().notNull().default('queued'),
  provider: text(),
  providerRef: text(),
  error: text(),
  createdBy: text(),
  createdAt: created(),
  sentAt: at(),
}, (t) => [index().on(t.patientId), index().on(t.createdAt)]);

// Append-only; UPDATE/DELETE are blocked by triggers (drizzle/0001_audit_triggers.sql)
export const auditLog = pgTable('audit_log', {
  seq: bigserial({ mode: 'number' }).primaryKey(),
  at: at().notNull(),
  userId: text(),
  username: text(),
  role: text(),
  action: text().notNull(),
  entity: text(),
  entityId: text(),
  patientId: uuid(),
  details: jsonb(),
  ip: text(),
  prevHash: text().notNull(),
  hash: text().notNull(),
}, (t) => [index().on(t.patientId), index().on(t.userId), index().on(t.at)]);

export const idempotencyKeys = pgTable('idempotency_keys', {
  key: text().primaryKey(),
  userId: text(),
  status: integer().notNull(),
  body: jsonb(),
  createdAt: created(),
});
