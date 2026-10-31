'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import { searchIcd10 } from '@/lib/reference/icd10';
import type { Dx } from './types';

// ICD-10 search runs in the browser against the bundled code set, so it works offline
export function DiagnosisPicker({ value, onChange, disabled }: { value: Dx[]; onChange: (d: Dx[]) => void; disabled?: boolean }) {
  const [q, setQ] = useState('');
  const results = q.trim().length >= 2 ? searchIcd10(q).filter((r) => !value.some((v) => v.code === r.code)) : [];

  const add = (code: string, description: string) => {
    onChange([...value, { code, description, isPrimary: value.length === 0 }]);
    setQ('');
  };
  const remove = (code: string) => {
    const next = value.filter((v) => v.code !== code);
    if (next.length && !next.some((v) => v.isPrimary)) next[0] = { ...next[0], isPrimary: true };
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {value.map((d) => (
          <li key={d.code} className="flex items-center gap-2 rounded border border-line-soft px-2 py-1 text-sm">
            <label className="flex items-center gap-1 text-xs text-muted" title="Primary diagnosis">
              <input type="radio" name="primary-dx" checked={d.isPrimary} disabled={disabled} onChange={() => onChange(value.map((v) => ({ ...v, isPrimary: v.code === d.code })))} />
              {d.isPrimary ? 'Primary' : ''}
            </label>
            <span className="font-mono font-semibold">{d.code}</span>
            <span className="flex-1">{d.description}</span>
            {!disabled && <button type="button" className="text-muted hover:text-danger" aria-label={`Remove ${d.code}`} onClick={() => remove(d.code)}><X size={14} /></button>}
          </li>
        ))}
        {value.length === 0 && <li className="text-xs text-warn">No diagnosis yet — required before signing.</li>}
      </ul>
      {!disabled && (
        <div className="relative">
          <input className="input" placeholder="Search ICD-10 by code or words (e.g. I10, malaria, back pain)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search ICD-10" />
          {results.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-line bg-surface shadow-lg">
              {results.map((r) => (
                <li key={r.code}>
                  <button type="button" className="flex w-full gap-2 px-3 py-1.5 text-left text-sm hover:bg-brand-soft" onClick={() => add(r.code, r.description)}>
                    <span className="w-14 shrink-0 font-mono font-semibold">{r.code}</span>{r.description}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q.trim().length >= 2 && results.length === 0 && (
            <button type="button" className="mt-1 text-xs text-brand underline" onClick={() => {
              const m = /^([A-Z]\d{2}(?:\.\d{1,2})?)\s+(.+)$/i.exec(q.trim());
              if (m) add(m[1].toUpperCase(), m[2]);
              else alert('Type the code then the description, e.g. "K12.1 Stomatitis"');
            }}>Not in list — add as typed (code + description)</button>
          )}
        </div>
      )}
    </div>
  );
}
