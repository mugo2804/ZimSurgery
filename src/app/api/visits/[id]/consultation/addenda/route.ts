import { route } from '@/server/api';
import { addAddendum } from '@/server/services/clinical';
import { addendumInput } from '@/lib/clinical-schemas';

export const POST = route({ perm: 'clinical:write', body: addendumInput }, async ({ actor, params, body }) => addAddendum(actor!, params.id, body));
