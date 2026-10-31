import { route } from '@/server/api';
import { setBatchStatus } from '@/server/services/claims';
import { claimStatusInput } from '@/lib/billing-schemas';

export const POST = route({ perm: 'claims:manage', body: claimStatusInput }, async ({ actor, params, body }) => setBatchStatus(actor!, params.id, body.status, body.notes));
