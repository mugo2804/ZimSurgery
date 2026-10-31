import { route } from '@/server/api';
import { recordRemittance } from '@/server/services/claims';
import { remittanceInput } from '@/lib/billing-schemas';

export const POST = route({ perm: 'claims:manage', body: remittanceInput }, async ({ actor, params, body }) => recordRemittance(actor!, params.id, body));
