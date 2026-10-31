import { requirePage } from '@/server/session';
import { getInvoice } from '@/server/services/billing';
import { getSettings } from '@/server/services/settings';
import { audit } from '@/server/audit';
import { pageActor } from '@/server/session';
import { Letterhead } from '../../letterhead';
import { formatMoney, formatUSD, PAYMENT_METHOD_LABELS } from '@/lib/money';
import { fmtDate, fmtDateTime } from '@/lib/time';

export const metadata = { title: 'Invoice / receipt' };

export default async function PrintReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage('billing:read');
  const { id } = await params;
  const [inv, s] = await Promise.all([getInvoice(id), getSettings()]);
  await audit(await pageActor(user), { action: 'billing.print', entity: 'invoice', entityId: id, patientId: inv.patient.id });
  const aid = inv.payerType === 'medical_aid';
  const patientPays = inv.payments.filter((p) => p.method !== 'medical_aid');
  return (
    <article className="text-[13px]">
      <Letterhead s={s} title={inv.status === 'paid' ? 'Tax invoice / receipt' : 'Tax invoice'} number={inv.invoiceNo} />
      {inv.status === 'void' && <p className="mb-3 border-2 border-danger p-2 text-center text-lg font-black text-danger">VOID — {inv.voidReason}</p>}
      <section className="mb-4 grid grid-cols-2 gap-x-6 text-sm">
        <p><span className="text-muted">Patient:</span> <strong>{inv.patient.firstName} {inv.patient.lastName}</strong> ({inv.patient.fileNo})</p>
        <p><span className="text-muted">Date:</span> {fmtDate(inv.createdAt)}</p>
        <p><span className="text-muted">Address:</span> {[inv.patient.address, inv.patient.city].filter(Boolean).join(', ') || '—'}</p>
        <p><span className="text-muted">Payer:</span> {aid ? `${inv.medicalAidName} · ${inv.memberNo} · Dep. ${inv.dependantCode ?? '00'}` : 'Cash / private'}</p>
        {aid && <p className="col-span-2"><span className="text-muted">Principal member:</span> {inv.patient.maPrincipalName ?? '—'}</p>}
      </section>
      <table className="w-full border-collapse text-sm">
        <thead><tr className="border-b-2 border-ink text-left"><th className="py-1">Code</th><th>Description</th><th>ICD-10</th><th className="text-right">Qty</th><th className="text-right">Unit</th>{aid && <th className="text-right">Aid</th>}<th className="text-right">Amount</th></tr></thead>
        <tbody className="num">{inv.items.map((i) => (
          <tr key={i.id} className="border-b border-line-soft"><td className="py-1 font-mono">{i.code}</td><td>{i.description}</td><td className="font-mono">{i.icd10}</td><td className="text-right">{i.qty}</td>
            <td className="text-right">{formatUSD(i.unitCents)}</td>{aid && <td className="text-right">{formatUSD(i.aidTotalCents)}</td>}<td className="text-right">{formatUSD(i.totalCents)}</td></tr>
        ))}</tbody>
      </table>
      <div className="ml-auto mt-3 w-72 space-y-0.5 text-sm num">
        <p className="flex justify-between font-semibold"><span>Total</span><span>{formatUSD(inv.totalCents)}</span></p>
        {aid && <p className="flex justify-between"><span>Claimed from {inv.medicalAidName}</span><span>{formatUSD(inv.aidCents)}</span></p>}
        <p className="flex justify-between font-semibold"><span>{aid ? 'Patient shortfall' : 'Patient pays'}</span><span>{formatUSD(inv.patientCents)}</span></p>
        <p className="flex justify-between"><span>Paid</span><span>{formatUSD(inv.paidCents)}</span></p>
        <p className="flex justify-between border-t border-ink pt-1 text-base font-black"><span>Balance due</span><span>{formatUSD(inv.balanceCents)}</span></p>
      </div>
      {patientPays.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-1 text-sm font-bold uppercase">Payments received</h2>
          <table className="w-full text-sm num">
            <tbody>{patientPays.map((p) => (
              <tr key={p.id}><td className="font-mono">{p.receiptNo}</td><td>{fmtDateTime(p.receivedAt)}</td><td>{PAYMENT_METHOD_LABELS[p.method]}{p.reference ? ` (${p.reference})` : ''}</td>
                <td className="text-right">{formatMoney(p.amountMinor, p.currency)}{p.zigRate ? ` @ ${Number(p.zigRate).toFixed(4)} = ${formatUSD(p.usdCents)}` : ''}</td></tr>
            ))}</tbody>
          </table>
        </section>
      )}
      <p className="mt-8 text-center text-xs text-muted">Thank you. Prices in US dollars; ZiG payments converted at the rate shown. Received by {patientPays.at(-1)?.receivedByName ?? '—'}.</p>
    </article>
  );
}
