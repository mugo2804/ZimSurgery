import { route } from '@/server/api';
import { setVisitStatus } from '@/server/services/visits';
import { visitStatusInput } from '@/lib/schemas';

export const PATCH = route({ perm: 'queue:write', body: visitStatusInput }, async ({ actor, user, params, body }) =>
  setVisitStatus({ ...actor!, role: user.role }, params.id, body.status, body.doctorId));
