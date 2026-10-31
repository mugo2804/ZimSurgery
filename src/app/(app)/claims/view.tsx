'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, errMsg } from '@/client/api';
import { formatUSD } from '@/lib/money';
import { fmtDate } from '@/lib/time';

type Pending = { id: string; invoiceNo: string; createdAt: string; aidCents: number; medicalAidId: string; aid: string; memberNo: string | null; dependantCode: string | null; firstName: string; lastName: string };
type Batch = { b: { id: string; batchNo: string; status: string; totalCents: number; paidCents: number; createdAt: string; emailedAt: string | null }; aid: string; count: number };

const BADGE: Record<string, string> = { draft: 'badge-grey', submitted: 'badge-blue', paid: 'badge-green', rejected: 'badge-red' };

export function ClaimsView({ pending, batches, emailReady }: { pending: Pending[]; batches: Batch[]; emailReady: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const groups = [...new Map(pending.map((p) => [p.medicalAidId, p.aid])).entries()];

  async function batch(aidId: string) {
    const ids = pending.filter((p) => p.medicalAidId === aidId && selected.has(p.id)).map((p) => p.id);
    if (!ids.length) { setError('Tick the invoices to include'); return; }
    try {
      const r = await api<{ id: string }>('/api/claims', { body: { medicalAidId: aidId, invoiceIds: ids } });
      router.push(`/claims/${r.id}`);
    } catch (e) { setError(errMsg(e)); }
  }

  return (
    <div className="space-y-4">
      <h1>Medical aid claims</h1>
      {!emailReady && <p className="text-sm text-muted">Email is not configured (SMTP) — download batch CSVs and send them from the practice mailbox.</p>}
      {error && <p className="error-text">{error}</p>}
      {groups.length === 0 && <p className="card card-body text-muted">No invoices waiting to be claimed.</p>}
      {groups.map(([aidId, aidName]) => {
        const rows = pending.filter((p) => p.medicalAidId === aidId);
        const allOn = rows.every((r) => selected.has(r.id));
        const total = rows.filter((r) => selected.has(r.id)).reduce((s, r) => s + r.aidCents, 0);
        return (
          <section key={aidId} className="card">
            <div className="card-title">
              <span>{aidName} · {rows.length} waiting</span>
              <span className="flex items-center gap-2 text-sm font-normal">Selected {formatUSD(total)}<button className="btn btn-sm btn-primary" onClick={() => batch(aidId)}>Create batch</button></span>
            </div>
            <table className="table num">
              <thead><tr>
                <th><input type="checkbox" aria-label="Select all" checked={allOn} onChange={() => {
                  const next = new Set(selected); rows.forEach((r) => (allOn ? next.delete(r.id) : next.add(r.id))); setSelected(next);
                }} /></th>
                <th>Invoice</th><th>Date</th><th>Patient</th><th>Member no.</th><th className="text-right">Claim</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id}>
                  <td><input type="checkbox" aria-label={`Select ${r.invoiceNo}`} checked={selected.has(r.id)} onChange={() => { const n = new Set(selected); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); setSelected(n); }} /></td>
                  <td><Link className="font-mono text-brand hover:underline" href={`/billing/${r.id}`}>{r.invoiceNo}</Link></td><td>{fmtDate(r.createdAt)}</td>
                  <td>{r.lastName}, {r.firstName}</td><td className="font-mono">{r.memberNo} / {r.dependantCode}</td><td className="text-right">{formatUSD(r.aidCents)}</td>
                </tr>
              ))}</tbody>
            </table>
          </section>
        );
      })}

      <section className="card">
        <div className="card-title">Batches</div>
        <table className="table num">
          <thead><tr><th>Batch</th><th>Society</th><th>Created</th><th className="text-right">Invoices</th><th className="text-right">Claimed</th><th className="text-right">Paid</th><th>Status</th></tr></thead>
          <tbody>
            {batches.map(({ b, aid, count }) => (
              <tr key={b.id}><td><Link className="font-mono text-brand hover:underline" href={`/claims/${b.id}`}>{b.batchNo}</Link></td><td>{aid}</td><td>{fmtDate(b.createdAt)}</td>
                <td className="text-right">{count}</td><td className="text-right">{formatUSD(b.totalCents)}</td><td className="text-right">{formatUSD(b.paidCents)}</td>
                <td><span className={`badge ${BADGE[b.status]}`}>{b.status}</span>{b.emailedAt && <span className="ml-1 text-xs text-muted">emailed</span>}</td></tr>
            ))}
            {batches.length === 0 && <tr><td colSpan={7} className="text-muted">No batches yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
