import { route } from '@/server/api';
import { getOrCreateInvoiceForVisit } from '@/server/services/billing';

export const POST = route({ perm: 'billing:write' }, async ({ actor, params }) => getOrCreateInvoiceForVisit(actor!, params.id));
