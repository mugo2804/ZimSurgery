import { z } from 'zod';
import { route, zDay } from '@/server/api';
import { bookAppointment, listAppointments, listDoctors } from '@/server/services/appointments';
import { appointmentInput } from '@/lib/schemas';
import { localDay } from '@/lib/time';

export const GET = route({ perm: 'appointments:read', query: z.object({ day: zDay.optional() }) }, async ({ query }) => {
  const day = query.day ?? localDay();
  const [appointments, doctors] = await Promise.all([listAppointments(day), listDoctors()]);
  return { day, appointments, doctors };
});

export const POST = route({ perm: 'appointments:write', body: appointmentInput }, async ({ actor, body }) => bookAppointment(actor, body));
