import { z } from 'zod';
import { route } from '@/server/api';
import { findDuplicates } from '@/server/services/patients';

export const GET = route({
  perm: 'patients:read',
  query: z.object({
    firstName: z.string().max(80).default(''), lastName: z.string().max(80).default(''),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), nationalId: z.string().max(30).optional(), excludeId: z.uuid().optional(),
  }),
}, async ({ query }) => ({ duplicates: await findDuplicates(query, query.excludeId) }));
