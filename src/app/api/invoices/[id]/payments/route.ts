import { route } from '@/server/api';
import { recordPayment } from '@/server/services/billing';
import { paymentInput } from '@/lib/billing-schemas';

export const POST = route({ perm: 'billing:write', body: paymentInput }, async ({ actor, params, body }) => recordPayment(actor!, params.id, body));
