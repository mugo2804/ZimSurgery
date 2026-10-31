import { route } from '@/server/api';
import { updatePatient, viewPatient } from '@/server/services/patients';
import { patientInput } from '@/lib/schemas';

export const GET = route({ perm: 'patients:read' }, async ({ actor, params }) => ({ patient: await viewPatient(actor, params.id, 'api') }));

export const PUT = route({ perm: 'patients:write', body: patientInput }, async ({ actor, params, body }) => updatePatient(actor, params.id, body));
