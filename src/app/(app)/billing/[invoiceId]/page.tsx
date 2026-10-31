import { requirePage } from '@/server/session';
import { getInvoice, listTariffs } from '@/server/services/billing';
import { currentRate } from '@/server/services/settings';
import { can } from '@/lib/rbac';
import { InvoiceEditor } from './editor';

export const metadata = { title: 'Invoice' };

export default async function InvoicePage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const user = await requirePage('billing:read');
  const { invoiceId } = await params;
  const [invoice, tariffs, rate] = await Promise.all([getInvoice(invoiceId), listTariffs(), currentRate()]);
  return (
    <InvoiceEditor
      invoice={JSON.parse(JSON.stringify(invoice))}
      tariffs={tariffs.map((t) => ({ id: t.id, code: t.code, description: t.description, category: t.category, cashCents: t.cashCents, aidCents: t.aidRates.find((r) => r.medicalAidId === invoice.medicalAidId)?.aidCents ?? t.aidCents }))}
      rate={rate ? { zigPerUsd: rate.zigPerUsd, isToday: rate.isToday } : null}
      canWrite={can(user.role, 'billing:write')}
      canVoid={can(user.role, 'invoices:void')}
    />
  );
}
