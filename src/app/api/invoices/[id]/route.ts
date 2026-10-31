import { route } from '@/server/api';
import { getInvoice } from '@/server/services/billing';

export const GET = route({ perm: 'billing:read' }, async ({ params }) => ({ invoice: await getInvoice(params.id) }));
