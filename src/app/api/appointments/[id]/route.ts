import { route } from '@/server/api';
import { actOnAppointment } from '@/server/services/appointments';
import { appointmentAction } from '@/lib/schemas';

export const PATCH = route({ perm: 'appointments:write', body: appointmentAction }, async ({ actor, params, body }) => actOnAppointment(actor, params.id, body));
