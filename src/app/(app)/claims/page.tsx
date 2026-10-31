import { requirePage } from '@/server/session';
import { listBatches, pendingClaims } from '@/server/services/claims';
import { emailConfigured } from '@/server/email';
import { ClaimsView } from './view';

export const metadata = { title: 'Medical aid claims' };

export default async function ClaimsPage() {
  await requirePage('claims:manage');
  const [pending, batches] = await Promise.all([pendingClaims(), listBatches()]);
  return <ClaimsView pending={JSON.parse(JSON.stringify(pending))} batches={JSON.parse(JSON.stringify(batches))} emailReady={emailConfigured()} />;
}
