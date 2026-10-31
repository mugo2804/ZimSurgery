'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Printer } from 'lucide-react';
import { api, errMsg } from '@/client/api';
import { LABS, LAB_TESTS } from '@/lib/reference/clinical';
import { fmtDateTime } from '@/lib/time';
import type { ConsultData } from './types';

const STATUS: Record<string, string> = { ordered: 'badge-blue', sample_taken: 'badge-amber', resulted: 'badge-green', cancelled: 'badge-grey' };

export function LabOrderForm({ visitId, existing, disabled }: { visitId: string; existing: ConsultData['labOrders']; disabled: boolean }) {
  const router = useRouter();
  const [lab, setLab] = useState<string>(LABS[0]);
  const [tests, setTests] = useState<string[]>([]);
  const [other, setOther] = useState('');
  const [info, setInfo] = useState('');
  const [urgency, setUrgency] = useState<'routine' | 'urgent'>('routine');
  const [error, setError] = useState('');

  const toggle = (t: string) => setTests(tests.includes(t) ? tests.filter((x) => x !== t) : [...tests, t]);

  async function save() {
    setError('');
    const all = [...tests, ...other.split(',').map((s) => s.trim()).filter(Boolean)];
    try {
      const r = await api<{ id: string }>(`/api/visits/${visitId}/lab-orders`, { body: { lab, tests: all, clinicalInfo: info, urgency } });
      setTests([]); setOther(''); setInfo('');
      router.refresh();
      window.open(`/print/lab/${r.id}`, '_blank', 'noopener');
    } catch (e) { setError(errMsg(e)); }
  }

  return (
    <div className="space-y-4">
      {existing.map((o) => (
        <div key={o.id} className="rounded border border-line-soft p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold">{o.orderNo} · {o.lab} · {fmtDateTime(o.createdAt)} {o.urgency === 'urgent' && <span className="badge badge-red">Urgent</span>}</span>
            <span className="flex items-center gap-2"><span className={`badge ${STATUS[o.status]}`}>{o.status.replace('_', ' ')}</span>
              <a className="btn btn-sm" href={`/print/lab/${o.id}`} target="_blank" rel="noopener"><Printer size={13} /> Print</a></span>
          </div>
          <p>{o.tests.join(', ')}</p>
          {o.result && <p className="mt-1 whitespace-pre-wrap rounded bg-ok-soft p-2"><strong>Result:</strong> {o.result}</p>}
        </div>
      ))}
      {!disabled && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2"><label className="label">Laboratory / imaging centre</label>
              <select className="input" value={lab} onChange={(e) => setLab(e.target.value)}>{LABS.map((l) => <option key={l}>{l}</option>)}</select>
            </div>
            <div><label className="label">Urgency</label>
              <select className="input" value={urgency} onChange={(e) => setUrgency(e.target.value as 'routine' | 'urgent')}><option value="routine">Routine</option><option value="urgent">Urgent</option></select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LAB_TESTS.map((g) => (
              <fieldset key={g.group} className="rounded border border-line-soft p-2">
                <legend className="px-1 text-xs font-bold uppercase text-ink-soft">{g.group}</legend>
                {g.tests.map((t) => (
                  <label key={t} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={tests.includes(t)} onChange={() => toggle(t)} /> {t}</label>
                ))}
              </fieldset>
            ))}
          </div>
          <input className="input" placeholder="Other tests (comma separated)" value={other} onChange={(e) => setOther(e.target.value)} />
          <textarea className="input !min-h-16" placeholder="Clinical information for the lab" value={info} onChange={(e) => setInfo(e.target.value)} />
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-primary" disabled={!tests.length && !other.trim()} onClick={save}>Order & print requisition</button>
        </div>
      )}
    </div>
  );
}
