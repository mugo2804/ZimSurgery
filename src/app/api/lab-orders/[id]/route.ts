import { route } from '@/server/api';
import { updateLabOrder } from '@/server/services/clinical';
import { labResultInput } from '@/lib/clinical-schemas';

export const PATCH = route({ perm: 'labs:result', body: labResultInput }, async ({ actor, params, body }) => updateLabOrder(actor!, params.id, body));
