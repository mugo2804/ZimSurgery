import { route } from '@/server/api';
import { createBatch, listBatches, pendingClaims } from '@/server/services/claims';
import { claimBatchInput } from '@/lib/billing-schemas';

export const GET = route({ perm: 'claims:manage' }, async () => ({ pending: await pendingClaims(), batches: await listBatches() }));

export const POST = route({ perm: 'claims:manage', body: claimBatchInput }, async ({ actor, body }) => createBatch(actor!, body));
