import { route } from '@/server/api';
import { saveTariff } from '@/server/services/billing';
import { tariffInput } from '@/lib/billing-schemas';

export const PUT = route({ perm: 'admin:settings', body: tariffInput }, async ({ actor, params, body }) => saveTariff(actor!, params.id, body));
