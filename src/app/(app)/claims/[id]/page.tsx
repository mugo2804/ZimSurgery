import { requirePage } from '@/server/session';
import { getBatch } from '@/server/services/claims';
import { emailConfigured } from '@/server/email';
import { BatchView } from './view';

export const metadata = { title: 'Claim batch' };

export default async function BatchPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage('claims:manage');
  const { id } = await params;
  return <BatchView batch={JSON.parse(JSON.stringify(await getBatch(id)))} emailReady={emailConfigured()} />;
}
