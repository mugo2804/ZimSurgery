import { z } from 'zod';
import { route } from '@/server/api';
import { listTariffs, saveTariff } from '@/server/services/billing';
import { tariffInput } from '@/lib/billing-schemas';

export const GET = route({ perm: 'billing:read', query: z.object({ all: z.enum(['1', '0']).optional() }) }, async ({ query }) => ({ tariffs: await listTariffs(query.all === '1') }));

export const POST = route({ perm: 'admin:settings', body: tariffInput }, async ({ actor, body }) => saveTariff(actor!, null, body));
