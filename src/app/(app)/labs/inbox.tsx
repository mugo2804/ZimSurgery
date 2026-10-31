'use client';
import { Fragment, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, errMsg } from '@/client/api';
import { fmtDateTime } from '@/lib/time';

type Row = { id: string; orderNo: string; lab: string; tests: string[]; urgency: string; status: string; createdAt: string; patientId: string; firstName: string; lastName: string; fileNo: string; doctor: string };

export function LabInbox({ rows, canResult }: { rows: Row[]; canResult: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  async function update(id: string, status: 'sample_taken' | 'resulted' | 'cancelled') {
    setError('');
    if (status === 'cancelled' && !window.confirm('Cancel this order?')) return;
    try {
      await api(`/api/lab-orders/${id}`, { method: 'PATCH', body: { status, result: status === 'resulted' ? result : undefined } });
      setOpen(null); setResult('');
      router.refresh();
    } catch (e) { setError(errMsg(e)); }
  }

  if (!rows.length) return <p className="card card-body text-muted">No outstanding orders.</p>;
  return (
    <div className="card overflow-x-auto">
      {error && <p className="error-text p-3">{error}</p>}
      <table className="table">
        <thead><tr><th>Ordered</th><th>Patient</th><th>Lab</th><th>Tests</th><th>Doctor</th><th>Status</th><th /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <Fragment key={r.id}>
              <tr>
                <td className="whitespace-nowrap">{fmtDateTime(r.createdAt)}<br /><span className="font-mono text-xs text-muted">{r.orderNo}</span></td>
                <td><Link className="font-semibold text-brand hover:underline" href={`/patients/${r.patientId}`}>{r.lastName}, {r.firstName}</Link></td>
                <td>{r.lab}</td>
                <td>{r.tests.join(', ')} {r.urgency === 'urgent' && <span className="badge badge-red">Urgent</span>}</td>
                <td>{r.doctor}</td>
                <td><span className={`badge ${r.status === 'ordered' ? 'badge-blue' : 'badge-amber'}`}>{r.status.replace('_', ' ')}</span></td>
                <td className="whitespace-nowrap text-right">
                  {canResult && r.status === 'ordered' && <button className="btn btn-sm" onClick={() => update(r.id, 'sample_taken')}>Sample taken</button>}{' '}
                  {canResult && <button className="btn btn-sm btn-primary" onClick={() => { setOpen(open === r.id ? null : r.id); setResult(''); }}>Enter result</button>}
                </td>
              </tr>
              {open === r.id && (
                <tr>
                  <td colSpan={7} className="bg-canvas">
                    <textarea className="input" autoFocus placeholder="Paste or type the result as reported by the lab" value={result} onChange={(e) => setResult(e.target.value)} />
                    <div className="mt-2 flex gap-2">
                      <button className="btn btn-primary" disabled={!result.trim()} onClick={() => update(r.id, 'resulted')}>Save result</button>
                      <button className="btn" onClick={() => update(r.id, 'cancelled')}>Cancel order</button>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
