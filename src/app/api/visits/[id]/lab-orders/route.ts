import { route } from '@/server/api';
import { createLabOrder } from '@/server/services/clinical';
import { labOrderInput } from '@/lib/clinical-schemas';

export const POST = route({ perm: 'clinical:write', body: labOrderInput }, async ({ actor, params, body }) => createLabOrder(actor!, params.id, body));
