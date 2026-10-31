import { route } from '@/server/api';
import { setInvoiceItems } from '@/server/services/billing';
import { invoiceItemsInput } from '@/lib/billing-schemas';

export const PUT = route({ perm: 'billing:write', body: invoiceItemsInput }, async ({ actor, params, body }) => setInvoiceItems(actor!, params.id, body));
