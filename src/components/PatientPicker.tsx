'use client';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { cachedGet } from '@/client/offline/outbox';
import { ageFrom } from '@/lib/validation';

export type PickedPatient = {
  id: string; fileNo: string; firstName: string; lastName: string; dob: string | null; sex: string | null;
  medicalAid: string | null; medicalAidId: string | null; allergyStatus: string; phone: string | null;
};

// Debounced patient search by name, file no., national ID, phone or medical aid number
export function PatientPicker({ onPick, autoFocus }: { onPick: (p: PickedPatient) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PickedPatient[]>([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(async () => {
      try {
        const r = await cachedGet<{ patients: PickedPatient[] }>(`/api/patients?q=${encodeURIComponent(q.trim())}`, { cache: false });
        setResults(r.data.patients);
        setNote(r.data.patients.length ? '' : 'No matching patients');
      } catch {
        setNote('Search needs a connection to the practice server');
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-2.5 top-2.5 text-muted" aria-hidden />
        <input className="input pl-8" placeholder="Name, file no., ID, phone or member no." autoFocus={autoFocus}
          value={q} onChange={(e) => { setQ(e.target.value); if (e.target.value.trim().length < 2) { setResults([]); setNote(''); } }} aria-label="Search patients" />
      </div>
      {note && <p className="mt-2 text-sm text-muted">{note}</p>}
      {results.length > 0 && (
        <ul className="mt-2 max-h-72 divide-y divide-line-soft overflow-auto rounded-md border border-line">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-brand-soft" onClick={() => onPick(p)}>
                <span>
                  <span className="font-semibold">{p.lastName}, {p.firstName}</span>
                  <span className="ml-2 text-muted">{p.fileNo} · {p.sex ?? '?'} {ageFrom(p.dob) ?? '?'}y</span>
                </span>
                <span className="text-xs text-muted">{p.medicalAid ?? 'Cash'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
