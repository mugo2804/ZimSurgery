'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/client/api';
import { fmtDate } from '@/lib/time';

type History = {
  diagnoses: { code: string; description: string; createdAt: string }[];
  medicines: { medicine: string; strength: string | null; frequency: string | null; createdAt: string }[];
  vitals: { id: string; recordedAt: string; bpSys: number | null; bpDia: number | null; weightKg: number | null; glucose: number | null }[];
  labs: { id: string; orderNo: string; tests: string[]; status: string; createdAt: string; result: string }[];
  consultations: { visitId: string; createdAt: string; status: string; doctor: string }[];
};

export function HistorySidebar({ patientId, visitId }: { patientId: string; visitId: string }) {
  const [h, setH] = useState<History | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<History>(`/api/patients/${patientId}/history?excludeVisit=${visitId}`).then(setH).catch((e) => setError(String(e.message ?? e)));
  }, [patientId, visitId]);

  const block = (title: string, children: React.ReactNode) => (
    <section className="card"><div className="card-title !py-2">{title}</div><div className="card-body !p-3 text-xs">{children}</div></section>
  );
  if (error) return <aside className="text-xs text-danger">{error}</aside>;
  if (!h) return <aside className="text-xs text-muted">Loading history…</aside>;
  const outstanding = h.labs.filter((l) => l.status === 'ordered' || l.status === 'sample_taken');

  return (
    <aside className="space-y-3">
      {block('Problem list', h.diagnoses.length ? (
        <ul className="space-y-0.5">{h.diagnoses.map((d) => <li key={d.code}><span className="font-mono font-semibold">{d.code}</span> {d.description} <span className="text-muted">· {fmtDate(d.createdAt)}</span></li>)}</ul>
      ) : <p className="text-muted">No previous diagnoses</p>)}
      {block('Recent medicines (6 months)', h.medicines.length ? (
        <ul className="space-y-0.5">{h.medicines.map((m, i) => <li key={i}>{m.medicine} {m.strength} <span className="text-muted">{m.frequency} · {fmtDate(m.createdAt)}</span></li>)}</ul>
      ) : <p className="text-muted">None recorded</p>)}
      {block('Vitals trend', h.vitals.length ? (
        <table className="w-full num"><thead><tr className="text-left text-muted"><th>Date</th><th>BP</th><th>Wt</th><th>Glu</th></tr></thead>
          <tbody>{h.vitals.map((v) => <tr key={v.id}><td>{fmtDate(v.recordedAt).slice(0, 6)}</td><td>{v.bpSys ?? '–'}/{v.bpDia ?? '–'}</td><td>{v.weightKg ?? '–'}</td><td>{v.glucose ?? '–'}</td></tr>)}</tbody></table>
      ) : <p className="text-muted">No vitals</p>)}
      {block(`Labs${outstanding.length ? ` · ${outstanding.length} outstanding` : ''}`, h.labs.length ? (
        <ul className="space-y-1">{h.labs.map((l) => (
          <li key={l.id}><span className={l.status === 'resulted' ? '' : 'font-semibold text-warn'}>{l.tests.slice(0, 3).join(', ')}{l.tests.length > 3 ? '…' : ''}</span> <span className="text-muted">· {l.status.replace('_', ' ')} · {fmtDate(l.createdAt)}</span>
            {l.result && <p className="line-clamp-2 text-ink-soft">{l.result}</p>}</li>
        ))}</ul>
      ) : <p className="text-muted">No lab orders</p>)}
      {block('Previous consultations', h.consultations.length ? (
        <ul className="space-y-0.5">{h.consultations.map((c) => <li key={c.visitId}><Link className="text-brand hover:underline" href={`/visits/${c.visitId}`}>{fmtDate(c.createdAt)}</Link> · Dr {c.doctor.split(' ').slice(-1)[0]}{c.status === 'draft' ? ' (draft)' : ''}</li>)}</ul>
      ) : <p className="text-muted">First consultation</p>)}
    </aside>
  );
}
