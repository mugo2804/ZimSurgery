import { z } from 'zod';

const money = z.coerce.number().min(0).max(1_000_000);

export const invoiceItemInput = z.object({
  tariffId: z.uuid().optional().nullable(),
  code: z.string().trim().max(20).optional().nullable(),
  description: z.string().trim().min(1).max(200),
  icd10: z.string().trim().max(10).optional().nullable().transform((v) => v || null),
  qty: z.coerce.number().int().min(1).max(100).default(1),
  /** Only used for ad-hoc lines without a tariff (USD) */
  unitPrice: money.optional(),
});

export const invoiceItemsInput = z.object({ items: z.array(invoiceItemInput).max(40) });

export const TENDER_METHODS = ['usd_cash', 'zig_cash', 'swipe', 'ecocash', 'innbucks', 'bank_transfer'] as const;

export const tenderInput = z.object({
  method: z.enum(TENDER_METHODS),
  currency: z.enum(['USD', 'ZiG']),
  amount: z.coerce.number().positive().max(10_000_000),
  reference: z.string().trim().max(60).optional().nullable(),
}).refine((t) => !(t.method === 'usd_cash' && t.currency !== 'USD') && !(t.method === 'zig_cash' && t.currency !== 'ZiG'), {
  message: 'Cash tender currency does not match the method',
});

export const paymentInput = z.object({ tenders: z.array(tenderInput).min(1).max(6) });

export const voidInput = z.object({ reason: z.string().trim().min(5, 'Give a reason (at least 5 characters)').max(300) });

export const rateInput = z.object({
  zigPerUsd: z.coerce.number().positive().max(100_000),
  source: z.string().trim().min(2).max(120),
});

export const tariffInput = z.object({
  code: z.string().trim().min(1).max(20),
  description: z.string().trim().min(1).max(200),
  category: z.string().trim().max(60).optional().nullable(),
  cashPrice: money,
  aidPrice: money,
  active: z.boolean().default(true),
  aidRates: z.array(z.object({ medicalAidId: z.uuid(), price: money })).max(30).default([]),
});

export const cashupInput = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cashierId: z.string().min(1).optional().nullable(),
  declaredUsd: money,
  declaredZig: money,
  notes: z.string().trim().max(500).optional().nullable(),
});

export const claimBatchInput = z.object({ medicalAidId: z.uuid(), invoiceIds: z.array(z.uuid()).min(1).max(500) });

export const claimStatusInput = z.object({ status: z.enum(['submitted', 'rejected']), notes: z.string().trim().max(300).optional() });

export const remittanceInput = z.object({
  lines: z.array(z.object({
    invoiceId: z.uuid(),
    paid: money,
    rejected: z.boolean().default(false),
    note: z.string().trim().max(200).optional().nullable(),
  })).min(1),
  reference: z.string().trim().max(60).optional().nullable(),
});
