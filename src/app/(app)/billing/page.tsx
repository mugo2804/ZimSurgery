import Link from 'next/link';
import { requirePage } from '@/server/session';
import { billingWorklist, listInvoices } from '@/server/services/billing';
import { currentRate } from '@/server/services/settings';
import { can } from '@/lib/rbac';
import { formatUSD } from '@/lib/money';
import { fmtDate, fmtTime, localDay } from '@/lib/time';
import { RateForm } from './rate-form';

export const metadata = { title: 'Billing' };

const STATUS: Record<string, string> = { open: 'badge-amber', partially_paid: 'badge-amber', paid: 'badge-green', void: 'badge-grey' };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const user = await requirePage('billing:read');
  const sp = await searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.day ?? '') ? sp.day! : localDay();
  const [work, invoices, rate] = await Promise.all([billingWorklist(), listInvoices(day), currentRate()]);
  const write = can(user.role, 'billing:write');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1>Billing</h1>
        <div className="flex gap-2">
          <Link href="/billing/tariffs" className="btn">Tariffs</Link>
          {can(user.role, 'cashup:view') && <Link href="/cashup" className="btn">Cash-up</Link>}
        </div>
      </div>

      {write && <RateForm current={rate ? { zigPerUsd: rate.zigPerUsd, source: rate.source, isToday: rate.isToday } : null} />}

      <section className="card">
        <div className="card-title">Waiting to pay <span className="badge badge-grey">{work.awaiting.length}</span></div>
        <table className="table">
          <thead><tr><th>Patient</th><th>Checked in</th><th>Payer</th><th>Invoice</th><th /></tr></thead>
          <tbody>
            {work.awaiting.map((w) => (
              <tr key={w.visitId}>
                <td><Link className="font-semibold text-brand hover:underline" href={`/patients/${w.patientId}`}>{w.lastName}, {w.firstName}</Link> <span className="font-mono text-xs text-muted">{w.fileNo}</span></td>
                <td>{fmtTime(w.checkedInAt)}</td>
                <td>{w.payerType === 'medical_aid' ? 'Medical aid' : 'Cash'}</td>
                <td>{w.invoiceId ? <span className={`badge ${STATUS[w.invoiceStatus ?? 'open']}`}>{w.invoiceStatus}</span> : <span className="text-muted">not started</span>}</td>
                <td className="text-right">{write && <Link className="btn btn-sm btn-primary" href={w.invoiceId ? `/billing/${w.invoiceId}` : `/billing/visit/${w.visitId}`}>Bill</Link>}</td>
              </tr>
            ))}
            {work.awaiting.length === 0 && <tr><td colSpan={5} className="text-muted">Nobody waiting at billing.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card">
        <div className="card-title">
          <span>Invoices · {fmtDate(`${day}T12:00:00+02:00`)}</span>
          <form className="flex gap-1"><input type="date" name="day" defaultValue={day} className="input !w-auto !py-1 text-xs" aria-label="Day" /><button className="btn btn-sm">Show</button></form>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>No.</th><th>Time</th><th>Patient</th><th>Payer</th><th className="text-right">Total</th><th className="text-right">Aid</th><th className="text-right">Patient</th><th className="text-right">Paid</th><th>Status</th></tr></thead>
            <tbody className="num">
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td><Link className="font-mono text-brand hover:underline" href={`/billing/${i.id}`}>{i.invoiceNo}</Link></td>
                  <td>{fmtTime(i.createdAt)}</td>
                  <td>{i.lastName}, {i.firstName}</td>
                  <td>{i.aid ?? 'Cash'}</td>
                  <td className="text-right">{formatUSD(i.totalCents)}</td>
                  <td className="text-right">{i.aidCents ? formatUSD(i.aidCents) : '—'}</td>
                  <td className="text-right">{formatUSD(i.patientCents)}</td>
                  <td className="text-right">{formatUSD(i.paidCents)}</td>
                  <td><span className={`badge ${STATUS[i.status]}`}>{i.status.replace('_', ' ')}</span></td>
                </tr>
              ))}
              {invoices.length === 0 && <tr><td colSpan={9} className="text-muted">No invoices on this day.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {work.owing.length > 0 && (
        <section className="card">
          <div className="card-title">Older invoices with a balance owing</div>
          <table className="table num">
            <thead><tr><th>No.</th><th>Date</th><th>Patient</th><th className="text-right">Owing</th></tr></thead>
            <tbody>{work.owing.map((o) => (
              <tr key={o.id}><td><Link className="font-mono text-brand hover:underline" href={`/billing/${o.id}`}>{o.invoiceNo}</Link></td><td>{fmtDate(o.createdAt)}</td><td>{o.lastName}, {o.firstName}</td><td className="text-right">{formatUSD(o.patientCents - o.paidCents)}</td></tr>
            ))}</tbody>
          </table>
        </section>
      )}
    </div>
  );
}
