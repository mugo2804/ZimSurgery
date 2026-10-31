import { route } from '@/server/api';
import { recordVitals } from '@/server/services/clinical';
import { vitalsInput } from '@/lib/clinical-schemas';

export const POST = route({ perm: 'vitals:write', body: vitalsInput }, async ({ actor, params, body }) => recordVitals(actor!, params.id, body));
