import { route } from '@/server/api';
import { getConsultation, saveConsultation } from '@/server/services/clinical';
import { consultationInput } from '@/lib/clinical-schemas';

export const GET = route({ perm: 'clinical:read' }, async ({ actor, params }) => getConsultation(actor!, params.id));

export const PUT = route({ perm: 'clinical:write', body: consultationInput }, async ({ actor, params, body }) => saveConsultation(actor!, params.id, body));
