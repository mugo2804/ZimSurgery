import { route } from '@/server/api';
import { rateHistory, setExchangeRate } from '@/server/services/billing';
import { currentRate } from '@/server/services/settings';
import { rateInput } from '@/lib/billing-schemas';

export const GET = route({ perm: 'billing:read' }, async () => ({ current: await currentRate(), history: await rateHistory() }));

// Front desk and the practice manager may record the day's rate
export const POST = route({ perm: 'billing:write', body: rateInput }, async ({ actor, body }) => setExchangeRate(actor!, body));
