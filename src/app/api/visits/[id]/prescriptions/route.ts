import { route } from '@/server/api';
import { createPrescription } from '@/server/services/clinical';
import { prescriptionInput } from '@/lib/clinical-schemas';

export const POST = route({ perm: 'clinical:write', body: prescriptionInput }, async ({ actor, params, body }) => createPrescription(actor!, params.id, body));
