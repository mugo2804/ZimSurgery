import { z } from 'zod';
import { route } from '@/server/api';
import { createPatient, searchPatients } from '@/server/services/patients';
import { patientInput } from '@/lib/schemas';

export const GET = route({ perm: 'patients:read', query: z.object({ q: z.string().max(100).default('') }) },
  async ({ query }) => ({ patients: await searchPatients(query.q) }));

export const POST = route({ perm: 'patients:write', body: patientInput }, async ({ actor, body }) => createPatient(actor, body));
