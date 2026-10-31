'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { offlineWrite } from '@/client/offline/outbox';
import { ApiError, errMsg } from '@/client/api';
import { vitalFlags, PROCEDURE_ROUTES, type VitalKey } from '@/lib/reference/clinical';
import { bmi } from '@/lib/validation';

type Stock = { id: string; name: string; qty: number; batchNo: string | null };

// No placeholder values: a grey "120" can be misread as a recorded measurement
const FIELDS: { key: VitalKey | 'weightKg' | 'heightCm' | 'painScore'; label: string; unit: string; step?: string }[] = [
  { key: 'bpSys', label: 'BP systolic', unit: 'mmHg' },
  { key: 'bpDia', label: 'BP diastolic', unit: 'mmHg' },
  { key: 'pulse', label: 'Pulse', unit: 'bpm' },
  { key: 'respRate', label: 'Resp. rate', unit: '/min' },
  { key: 'tempC', label: 'Temperature', unit: '°C', step: '0.1' },
  { key: 'spo2', label: 'SpO₂', unit: '%' },
  { key: 'weightKg', label: 'Weight', unit: 'kg', step: '0.1' },
  { key: 'heightCm', label: 'Height', unit: 'cm', step: '0.5' },
  { key: 'glucose', label: 'Random glucose', unit: 'mmol/L', step: '0.1' },
  { key: 'painScore', label: 'Pain score', unit: '0–10' },
];

export function TriageForm({ visitId, stock }: { visitId: string; stock: Stock[] }) {
  const router = useRouter();
  const [v, setV] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [proc, setProc] = useState({ item: '', dose: '', route: 'IM', site: '', batchNo: '', stockItemId: '', deductStock: true });
  const [procMsg, setProcMsg] = useState('');

  const n = (k: string) => (v[k] === undefined || v[k] === '' ? null : Number(v[k]));
  const flags = vitalFlags({ bpSys: n('bpSys'), bpDia: n('bpDia'), pulse: n('pulse'), respRate: n('respRate'), tempC: n('tempC'), spo2: n('spo2'), glucose: n('glucose') });
  const bmiValue = bmi(n('weightKg'), n('heightCm'));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { id: crypto.randomUUID(), ...Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '')), notes };
      const res = await offlineWrite(`/api/visits/${visitId}/vitals`, { body, label: 'Triage vitals' });
      if (res.queued) alert('Offline — vitals saved on this device and will sync automatically.');
      router.push('/queue');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveProcedure() {
    setProcMsg('');
    if (!proc.item.trim()) { setProcMsg('Enter what was given or done'); return; }
    try {
      const res = await offlineWrite(`/api/visits/${visitId}/procedures`, {
        body: { id: crypto.randomUUID(), ...proc, stockItemId: proc.stockItemId || null, deductStock: !!proc.stockItemId && proc.deductStock },
        label: `Procedure: ${proc.item}`,
      });
      setProcMsg(res.queued ? 'Saved offline — will sync.' : `Recorded: ${proc.item}`);
      setProc({ item: '', dose: '', route: 'IM', site: '', batchNo: '', stockItemId: '', deductStock: true });
    } catch (err) { setProcMsg(errMsg(err)); }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="card">
        <div className="card-title">Vital signs</div>
        <div className="card-body space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {FIELDS.map((f) => {
              const flag = flags[f.key as VitalKey];
              return (
                <div key={f.key}>
                  <label className="label" htmlFor={f.key}>{f.label} <span className="normal-case text-muted">({f.unit})</span></label>
                  <input id={f.key} type="number" inputMode="decimal" step={f.step ?? '1'}
                    className={`input text-lg font-semibold num ${flag === 'high' ? 'input-flag-high' : flag === 'low' ? 'input-flag-low' : ''}`}
                    value={v[f.key] ?? ''} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
                  {flag && <p className={`mt-0.5 text-xs font-bold ${flag === 'high' ? 'text-danger' : 'text-warn'}`}>{flag === 'high' ? '▲ High' : '▼ Low'}</p>}
                </div>
              );
            })}
            <div>
              <span className="label">BMI</span>
              <p className="input bg-canvas text-lg font-semibold num">{bmiValue ?? '—'}</p>
              {bmiValue && <p className="mt-0.5 text-xs text-muted">{bmiValue < 18.5 ? 'Underweight' : bmiValue < 25 ? 'Normal' : bmiValue < 30 ? 'Overweight' : 'Obese'}</p>}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="notes">Triage notes</label>
            <textarea id="notes" className="input !min-h-16" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <p className="error-text" role="alert">{error}</p>}
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save & send to doctor'}</button>
        </div>
      </form>

      <section className="card">
        <div className="card-title">Injection / immunisation / procedure</div>
        <div className="card-body grid gap-3 sm:grid-cols-3">
          <div><label className="label">From stock</label>
            <select className="input" value={proc.stockItemId} onChange={(e) => {
              const s = stock.find((x) => x.id === e.target.value);
              setProc({ ...proc, stockItemId: e.target.value, item: s ? s.name : proc.item, batchNo: s?.batchNo ?? proc.batchNo });
            }}>
              <option value="">— not from stock —</option>
              {stock.map((s) => <option key={s.id} value={s.id} disabled={s.qty < 1}>{s.name} ({s.qty} left)</option>)}
            </select>
          </div>
          <div className="sm:col-span-2"><label className="label">Item / procedure</label><input className="input" value={proc.item} onChange={(e) => setProc({ ...proc, item: e.target.value })} placeholder="e.g. Tetanus toxoid, wound dressing" /></div>
          <div><label className="label">Dose</label><input className="input" value={proc.dose} onChange={(e) => setProc({ ...proc, dose: e.target.value })} /></div>
          <div><label className="label">Route</label>
            <select className="input" value={proc.route} onChange={(e) => setProc({ ...proc, route: e.target.value })}>{PROCEDURE_ROUTES.map((r) => <option key={r}>{r}</option>)}</select>
          </div>
          <div><label className="label">Site</label><input className="input" value={proc.site} onChange={(e) => setProc({ ...proc, site: e.target.value })} placeholder="L deltoid" /></div>
          <div><label className="label">Batch no.</label><input className="input font-mono" value={proc.batchNo} onChange={(e) => setProc({ ...proc, batchNo: e.target.value })} /></div>
          {proc.stockItemId && (
            <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={proc.deductStock} onChange={(e) => setProc({ ...proc, deductStock: e.target.checked })} /> Deduct 1 from stock</label>
          )}
          <div className="flex items-center gap-3 sm:col-span-3">
            <button type="button" className="btn" onClick={saveProcedure}>Record</button>
            {procMsg && <span className="text-sm">{procMsg}</span>}
          </div>
        </div>
      </section>
    </div>
  );
}
