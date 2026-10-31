import { z } from 'zod';
import { route, zDay } from '@/server/api';
import { cashupSummary, declareCashup } from '@/server/services/billing';
import { cashupInput } from '@/lib/billing-schemas';
import { can } from '@/lib/rbac';
import { localDay } from '@/lib/time';

// Cashiers see and declare their own takings; the practice manager can see everyone's (SECURITY §4)
export const GET = route({ perm: 'cashup:view', query: z.object({ day: zDay.optional(), cashierId: z.string().optional() }) }, async ({ user, query }) => {
  const cashierId = can(user.role, 'cashup:all') ? query.cashierId || null : user.id;
  return cashupSummary(query.day ?? localDay(), cashierId);
});

export const POST = route({ perm: 'cashup:view', body: cashupInput }, async ({ actor, user, body }) => {
  const cashierId = can(user.role, 'cashup:all') ? body.cashierId || null : user.id;
  return declareCashup(actor!, { ...body, cashierId });
});
