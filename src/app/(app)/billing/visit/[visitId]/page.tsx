import { requirePage } from '@/server/session';
import { OpenInvoice } from './open';

export default async function BillVisitPage({ params }: { params: Promise<{ visitId: string }> }) {
  await requirePage('billing:write');
  const { visitId } = await params;
  return <OpenInvoice visitId={visitId} />;
}
