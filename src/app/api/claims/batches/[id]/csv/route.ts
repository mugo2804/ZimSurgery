import { route } from '@/server/api';
import { batchCsv } from '@/server/services/claims';

export const GET = route({ perm: 'claims:manage' }, async ({ actor, params }) => {
  const { filename, csv } = await batchCsv(actor!, params.id);
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' },
  });
});
