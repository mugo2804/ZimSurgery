import { route } from '@/server/api';
import { checkIn, queueBoard } from '@/server/services/visits';
import { checkInInput } from '@/lib/schemas';

export const GET = route({ perm: 'queue:read' }, async () => ({ visits: await queueBoard(), serverTime: new Date().toISOString() }));

export const POST = route({ perm: 'queue:write', body: checkInInput }, async ({ actor, body }) => checkIn(actor, body));
