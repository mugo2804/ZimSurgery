'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, Mail } from 'lucide-react';
import { api, errMsg } from '@/client/api';
import { formatUSD } from '@/lib/money';
import { fmtDate, fmtDateTime } from '@/lib/time';

type Inv = { id: string; invoiceNo: string; createdAt: string; aidCents: number; claimStatus: string; claimPaidCents: number; claimNote: string | null; memberNo: string | null; dependantCode: string | null; firstName: string; lastName: string };
type Batch = { id: string; batchNo: string; status: string; totalCents: number; paidCents: number; createdAt: string; emailedAt: string | null; submittedAt: string | null; notes: string | null; aid: { name: string; claimsEmail: string | null }; invoices: Inv[] };

export function BatchView({ batch, emailReady }: { batch: Batch; emailReady: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const open = batch.invoices.filter((i) => ['batched', 'submitted'].includes(i.claimStatus));
  const [remit, setRemit] = useState<Record<string, { paid: string; rejected: boolean; note: string }>>(
    Object.fromEntries(open.map((i) => [i.id, { paid: (i.aidCents / 100).toFixed(2), rejected: false, note: '' }])),
  );
  const [reference, setReference] = useState('');

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setError(''); setMsg('');
    try { await fn(); setMsg(ok); router.refresh(); } catch (e) { setError(errMsg(e)); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1>Claim batch <span className="font-mono">{batch.batchNo}</span> <span className="badge badge-blue">{batch.status}</span></h1>
          <p className="text-sm text-muted">{batch.aid.name} · {batch.invoices.length} invoices · claimed {formatUSD(batch.totalCents)} · paid {formatUSD(batch.paidCents)} · created {fmtDate(batch.createdAt)}
            {batch.emailedAt && ` · emailed ${fmtDateTime(batch.emailedAt)}`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn" href={`/api/claims/batches/${batch.id}/csv`}><Download size={15} /> Download CSV</a>
          {emailReady && batch.aid.claimsEmail && batch.status !== 'paid' && (
            <button className="btn" onClick={() => run(() => api(`/api/claims/batches/${batch.id}/email`, { method: 'POST' }), `Emailed to ${batch.aid.claimsEmail}`)}><Mail size={15} /> Email to {batch.aid.name}</button>
          )}
          {batch.status === 'draft' && <button className="btn btn-primary" onClick={() => run(() => api(`/api/claims/batches/${batch.id}/status`, { body: { status: 'submitted' } }), 'Marked as submitted')}>Mark submitted</button>}
          {['draft', 'submitted'].includes(batch.status) && (
            <button className="btn btn-danger" onClick={() => {
              const notes = window.prompt('Reason the society rejected the whole batch (invoices return to the pending list):');
              if (notes) void run(() => api(`/api/claims/batches/${batch.id}/status`, { body: { status: 'rejected', notes } }), 'Batch rejected');
            }}>Batch rejected</button>
          )}
        </div>
      </div>
      {msg && <p className="text-sm font-semibold text-ok">{msg}</p>}
      {error && <p className="error-text">{error}</p>}

      <section className="card">
        <div className="card-title">Invoices {open.length > 0 && batch.status !== 'rejected' && <span className="text-xs font-normal text-muted">Enter the remittance advice when payment arrives</span>}</div>
        <table className="table num">
          <thead><tr><th>Invoice</th><th>Patient</th><th>Member</th><th className="text-right">Claimed</th><th>Status</th><th className="text-right">Paid by aid</th><th>Rejected</th><th>Note</th></tr></thead>
          <tbody>{batch.invoices.map((i) => {
            const r = remit[i.id];
            return (
              <tr key={i.id}>
                <td><Link className="font-mono text-brand hover:underline" href={`/billing/${i.id}`}>{i.invoiceNo}</Link></td><td>{i.lastName}, {i.firstName}</td>
                <td className="font-mono">{i.memberNo}/{i.dependantCode}</td><td className="text-right">{formatUSD(i.aidCents)}</td><td>{i.claimStatus}</td>
                {r && batch.status !== 'rejected' ? (<>
                  <td className="text-right"><input type="number" step="0.01" min={0} max={i.aidCents / 100} className="input !w-28 !py-1 text-right" value={r.paid} disabled={r.rejected}
                    onChange={(e) => setRemit({ ...remit, [i.id]: { ...r, paid: e.target.value } })} aria-label="Paid" /></td>
                  <td><input type="checkbox" checked={r.rejected} onChange={(e) => setRemit({ ...remit, [i.id]: { ...r, rejected: e.target.checked, paid: e.target.checked ? '0' : r.paid } })} aria-label="Rejected" /></td>
                  <td><input className="input !py-1" value={r.note} onChange={(e) => setRemit({ ...remit, [i.id]: { ...r, note: e.target.value } })} aria-label="Note" /></td>
                </>) : (<><td className="text-right">{formatUSD(i.claimPaidCents)}</td><td>{i.claimStatus === 'rejected' ? 'Yes' : ''}</td><td>{i.claimNote}</td></>)}
              </tr>
            );
          })}</tbody>
        </table>
        {open.length > 0 && batch.status !== 'rejected' && (
          <div className="card-body flex flex-wrap items-end gap-2 border-t border-line-soft">
            <div><label className="label">Remittance / EFT reference</label><input className="input" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
            <button className="btn btn-primary" onClick={() => run(() => api(`/api/claims/batches/${batch.id}/remittance`, {
              body: { reference: reference || null, lines: open.map((i) => ({ invoiceId: i.id, paid: Number(remit[i.id].paid || 0), rejected: remit[i.id].rejected, note: remit[i.id].note || null })) },
            }), 'Remittance recorded')}>Record remittance</button>
          </div>
        )}
      </section>
    </div>
  );
}
