'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Printer, Trash2 } from 'lucide-react';
import { api, errMsg } from '@/client/api';
import { allergyConflicts, searchMedicines, type Medicine } from '@/lib/reference/medicines';
import { fmtDateTime } from '@/lib/time';
import type { ConsultData, PatientLite } from './types';

type Item = { medicine: string; strength: string; form: string; dose: string; frequency: string; duration: string; quantity: string; instructions: string };
const fromMedicine = (m: Medicine): Item => ({ medicine: m.name, strength: m.strength, form: m.form, dose: m.dose, frequency: m.frequency, duration: m.duration ?? '', quantity: '', instructions: '' });

type Props = { visitId: string; patient: PatientLite; existing: ConsultData['prescriptions']; canPrint: boolean; disabled: boolean };

export function RxBuilder({ visitId, patient, existing, canPrint, disabled }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState('');
  const [notes, setNotes] = useState('');
  const [override, setOverride] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const results = q.trim().length >= 2 ? searchMedicines(q) : [];

  // C3: live allergy check against the patient's recorded allergies
  const conflicts = items.flatMap((i) => allergyConflicts(i.medicine, patient.allergies).map((a) => `${i.medicine} ↔ ${a}`));
  const update = (idx: number, k: keyof Item, v: string) => setItems(items.map((it, i) => (i === idx ? { ...it, [k]: v } : it)));

  async function save() {
    setBusy(true);
    setError('');
    try {
      const r = await api<{ id: string }>(`/api/visits/${visitId}/prescriptions`, { body: { items, notes, allergyOverrideReason: conflicts.length ? override : null } });
      setItems([]); setNotes(''); setOverride('');
      router.refresh();
      if (canPrint) window.open(`/print/rx/${r.id}`, '_blank', 'noopener');
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      {existing.map((rx) => (
        <div key={rx.id} className="rounded border border-line-soft p-3 text-sm">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold">{rx.rxNo} · {fmtDateTime(rx.createdAt)}</span>
            {canPrint ? <a className="btn btn-sm" href={`/print/rx/${rx.id}`} target="_blank" rel="noopener"><Printer size={13} /> Print</a>
              : <span className="text-xs text-danger">Add your HPZ/MDPCZ number to print</span>}
          </div>
          <ul className="list-disc pl-5">{rx.items.map((i) => <li key={i.id}>{i.medicine} {i.strength} — {i.dose} {i.frequency}{i.duration ? ` × ${i.duration}` : ''}</li>)}</ul>
          {rx.allergyOverrideReason && <p className="mt-1 text-xs text-danger">Allergy override: {rx.allergyOverrideReason}</p>}
        </div>
      ))}

      {!disabled && (<>
        {patient.allergyStatus === 'unknown' && <p className="text-sm font-semibold text-warn">Allergy status not recorded — confirm with the patient before prescribing.</p>}
        <div className="relative">
          <input className="input" placeholder="Search medicine (e.g. amoxicillin, metformin, antihistamine)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search medicines" />
          {results.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-line bg-surface shadow-lg">
              {results.map((m, i) => {
                const hit = allergyConflicts(m.name, patient.allergies);
                return (
                  <li key={`${m.name}-${m.strength}-${i}`}>
                    <button type="button" className="flex w-full justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-brand-soft" onClick={() => { setItems([...items, fromMedicine(m)]); setQ(''); }}>
                      <span><strong>{m.name}</strong> {m.strength} <span className="text-muted">{m.form}</span></span>
                      {hit.length > 0 && <span className="badge badge-red"><AlertTriangle size={12} /> {hit.join(', ')} allergy</span>}
                    </button>
                  </li>
                );
              })}
              <li><button type="button" className="w-full px-3 py-1.5 text-left text-xs text-brand hover:bg-brand-soft" onClick={() => { setItems([...items, { ...fromMedicine({ name: q.trim(), strength: '', form: '', dose: '', frequency: '', classes: [] }) }]); setQ(''); }}>+ Add “{q.trim()}” as typed</button></li>
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Medicine</th><th>Strength</th><th>Dose</th><th>Frequency</th><th>Duration</th><th>Qty</th><th>Instructions</th><th /></tr></thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className={allergyConflicts(it.medicine, patient.allergies).length ? 'bg-danger-soft' : ''}>
                    <td className="font-semibold">{it.medicine}</td>
                    {(['strength', 'dose', 'frequency', 'duration', 'quantity', 'instructions'] as const).map((k) => (
                      <td key={k}><input className="input !py-1 text-xs" value={it[k]} onChange={(e) => update(i, k, e.target.value)} aria-label={k} /></td>
                    ))}
                    <td><button className="btn btn-ghost btn-sm" aria-label="Remove" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {conflicts.length > 0 && (
          <div className="rounded-md border-2 border-danger bg-danger-soft p-3 text-sm text-danger" role="alert">
            <p className="flex items-center gap-2 font-bold"><AlertTriangle size={16} /> Allergy conflict: {conflicts.join('; ')}</p>
            <label className="mt-2 block text-xs font-semibold uppercase">Reason for overriding (required, recorded in the audit log)</label>
            <input className="input mt-1" value={override} onChange={(e) => setOverride(e.target.value)} placeholder="e.g. Tolerated previously; reaction was mild GI upset" />
          </div>
        )}

        {items.length > 0 && (
          <>
            <input className="input" placeholder="Notes for the pharmacist (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            {error && <p className="error-text" role="alert">{error}</p>}
            <button className="btn btn-primary" disabled={busy || (conflicts.length > 0 && !override.trim())} onClick={save}>
              {busy ? 'Saving…' : canPrint ? 'Save & print prescription' : 'Save prescription'}
            </button>
          </>
        )}
      </>)}
    </div>
  );
}
