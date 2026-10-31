import { route } from '@/server/api';
import { recordProcedure } from '@/server/services/clinical';
import { procedureInput } from '@/lib/clinical-schemas';

export const POST = route({ perm: 'procedures:write', body: procedureInput }, async ({ actor, params, body }) => recordProcedure(actor!, params.id, body));
