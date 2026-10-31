import { route } from '@/server/api';
import { emailBatch } from '@/server/services/claims';

export const POST = route({ perm: 'claims:manage' }, async ({ actor, params }) => emailBatch(actor!, params.id));
