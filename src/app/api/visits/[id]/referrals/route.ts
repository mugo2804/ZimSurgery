import { route } from '@/server/api';
import { createReferral } from '@/server/services/clinical';
import { referralInput } from '@/lib/clinical-schemas';

export const POST = route({ perm: 'clinical:write', body: referralInput }, async ({ actor, params, body }) => createReferral(actor!, params.id, body));
