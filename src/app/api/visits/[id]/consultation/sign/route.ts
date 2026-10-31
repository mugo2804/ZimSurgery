import { route } from '@/server/api';
import { signConsultation } from '@/server/services/clinical';

export const POST = route({ perm: 'clinical:write' }, async ({ actor, params }) => signConsultation(actor!, params.id));
