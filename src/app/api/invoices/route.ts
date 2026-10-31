import { z } from 'zod';
import { route, zDay } from '@/server/api';
import { listInvoices } from '@/server/services/billing';
import { localDay } from '@/lib/time';

export const GET = route({ perm: 'billing:read', query: z.object({ day: zDay.optional(), status: z.enum(['open', 'partially_paid', 'paid', 'void']).optional() }) },
  async ({ query }) => ({ invoices: await listInvoices(query.day ?? localDay(), query.status) }));
