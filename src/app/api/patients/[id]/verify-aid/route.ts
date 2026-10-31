import { route } from '@/server/api';
import { verifyMedicalAid } from '@/server/services/patients';
import { aidVerification } from '@/lib/schemas';

export const POST = route({ perm: 'patients:write', body: aidVerification }, async ({ actor, params, body }) => verifyMedicalAid(actor, params.id, body));
