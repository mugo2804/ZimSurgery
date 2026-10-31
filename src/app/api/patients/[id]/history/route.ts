import { z } from 'zod';
import { route } from '@/server/api';
import { clinicalHistory } from '@/server/services/clinical';
import { audit } from '@/server/audit';

export const GET = route({ perm: 'clinical:read', query: z.object({ excludeVisit: z.uuid().optional() }) }, async ({ actor, params, query }) => {
  await audit(actor, { action: 'clinical.history_view', entity: 'patient', entityId: params.id, patientId: params.id });
  return clinicalHistory(params.id, query.excludeVisit);
});
