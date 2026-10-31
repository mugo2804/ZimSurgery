import { route } from '@/server/api';
import { voidInvoice } from '@/server/services/billing';
import { voidInput } from '@/lib/billing-schemas';

export const POST = route({ perm: 'invoices:void', body: voidInput }, async ({ actor, params, body }) => voidInvoice(actor!, params.id, body.reason));
