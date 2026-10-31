'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Siren, UserPlus } from 'lucide-react';
import { cachedGet, offlineWrite } from '@/client/offline/outbox';
import { errMsg } from '@/client/api';
import { PatientPicker, type PickedPatient } from '@/components/PatientPicker';
import { CheckInDialog } from '@/components/CheckInDialog';
import { QUEUE_COLUMNS, QUEUE_LABELS } from '@/lib/schemas';
import { can, type Role } from '@/lib/rbac';
import { ageFrom } from '@/lib/validation';
import { fmtTime } from '@/lib/time';
import { useNow } from '@/client/use-now';
import type { QueueCard } from '@/server/services/visits';

type Card = Omit<QueueCard, 'checkedInAt' | 'statusChangedAt'> & { checkedInAt: string; statusChangedAt: string };

const POLL_MS = 15_000;

export function QueueBoard({ role, userId }: { role: Role; userId: string }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState('');
  const [skew, setSkew] = useState(0); // server clock − local clock, so wait times are right on PCs with wrong clocks
  const [mineOnly, setMineOnly] = useState(role === 'doctor');
  const [walkIn, setWalkIn] = useState<'pick' | PickedPatient | null>(null);
  const [notice, setNotice] = useState('');
  const loading = useRef(false);
  const now = useNow();

  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const r = await cachedGet<{ visits: Card[]; serverTime: string }>('/api/visits');
      setCards(r.data.visits);
      setStale(r.stale);
      if (!r.stale) setSkew(new Date(r.data.serverTime).getTime() - Date.now());
      setError('');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      loading.current = false;
    }
  }, []);

  useEffect(() => {
    // Initial fetch; state is set after the await, not synchronously
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const poll = setInterval(load, POLL_MS);
    let es: EventSource | null = null;
    if (typeof EventSource !== 'undefined') {
      es = new EventSource('/api/events/queue');
      es.addEventListener('queue.changed', () => void load());
    }
    return () => { clearInterval(poll); es?.close(); };
  }, [load]);

  async function move(card: Card, status: string) {
    setError('');
    const previous = cards;
    setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, status: status as Card['status'], statusChangedAt: new Date(Date.now() + skew).toISOString() } : c)));
    try {
      const res = await offlineWrite(`/api/visits/${card.id}/status`, { method: 'PATCH', body: { status }, label: `Move ${card.firstName} ${card.lastName} to ${QUEUE_LABELS[status]}` });
      if (res.queued) setNotice('Offline — the move is saved on this device and will sync.');
      else void load();
    } catch (e) {
      setCards(previous);
      setError(errMsg(e));
    }
  }

  const minutesIn = (c: Card) => Math.max(0, Math.floor((now + skew - new Date(c.statusChangedAt).getTime()) / 60_000));
  const allowed = (status: string) => (status === 'with_nurse' || status === 'with_doctor' ? can(role, 'queue:clinical') : true);
  const visible = cards.filter((c) => !mineOnly || c.doctorId === userId);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1>Waiting room</h1>
        <div className="flex flex-wrap items-center gap-2">
          {role === 'doctor' && (
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} /> My patients only</label>
          )}
          {can(role, 'queue:write') && <button className="btn btn-primary" onClick={() => setWalkIn('pick')}><UserPlus size={16} /> Walk-in check-in</button>}
        </div>
      </div>
      {stale && <p className="rounded-md bg-warn-soft px-3 py-2 text-sm font-semibold text-warn">Offline — showing the last saved board. Changes you make will sync when the server is reachable.</p>}
      {notice && <p className="rounded-md bg-brand-soft px-3 py-2 text-sm text-brand-strong">{notice}</p>}
      {error && <p className="error-text" role="alert">{error}</p>}

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {QUEUE_COLUMNS.map((col) => {
          const list = visible.filter((c) => c.status === col);
          const shown = col === 'completed' ? list.slice(-15).reverse() : list;
          return (
            <section key={col} className="flex min-h-40 flex-col rounded-lg border border-line bg-line-soft/60" aria-label={QUEUE_LABELS[col]}>
              <h2 className="flex items-center justify-between px-3 py-2 text-sm">
                {QUEUE_LABELS[col]} <span className="badge badge-grey num">{list.length}</span>
              </h2>
              <div className="flex-1 space-y-2 p-2 pt-0">
                {shown.map((c) => {
                  const mins = minutesIn(c);
                  const waitClass = col === 'completed' ? 'border-line' : mins >= 60 ? 'border-danger border-l-4' : mins >= 30 ? 'border-warn border-l-4' : 'border-line';
                  const severe = c.allergies.some((a) => a.severity === 'severe' || a.severity === 'anaphylaxis');
                  return (
                    <article key={c.id} className={`rounded-md border bg-surface p-2 text-sm shadow-sm ${waitClass}`}>
                      <div className="flex items-start justify-between gap-1">
                        <Link href={`/patients/${c.patientId}`} className="font-semibold leading-tight hover:underline">{c.lastName}, {c.firstName}</Link>
                        <span className="flex shrink-0 gap-0.5">
                          {c.priority === 'urgent' && <Siren size={15} className="text-danger" aria-label="Urgent" />}
                          {severe && <AlertTriangle size={15} className="text-danger" aria-label="Severe allergy" />}
                          {c.hasVitals && <CheckCircle2 size={15} className="text-ok" aria-label="Vitals recorded" />}
                        </span>
                      </div>
                      <p className="text-xs text-muted">{c.sex ?? '?'} {ageFrom(c.dob) ?? '?'}y · {c.payerType === 'medical_aid' ? c.medicalAid ?? 'Medical aid' : 'Cash'}</p>
                      <p className="text-xs text-muted">{c.doctorName ? `Dr ${c.doctorName.split(' ').slice(-1)[0]}` : 'Next available'} · in {fmtTime(c.checkedInAt)}</p>
                      {c.complaint && <p className="mt-1 truncate text-xs" title={c.complaint}>{c.complaint}</p>}
                      {col !== 'completed' && (
                        <p className={`mt-1 text-xs font-semibold num ${mins >= 60 ? 'text-danger' : mins >= 30 ? 'text-warn' : 'text-ink-soft'}`}>{mins} min here</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {can(role, 'vitals:write') && ['checked_in', 'with_nurse'].includes(c.status) && (
                          <Link href={`/visits/${c.id}/triage`} className="btn btn-sm">Triage</Link>
                        )}
                        {can(role, 'clinical:write') && ['triage_done', 'with_doctor', 'checked_in'].includes(c.status) && (
                          <Link href={`/visits/${c.id}/consult`} className="btn btn-sm btn-primary">Consult</Link>
                        )}
                        {can(role, 'billing:write') && c.status === 'billing' && (
                          <Link href={`/billing/visit/${c.id}`} className="btn btn-sm btn-primary">Bill</Link>
                        )}
                        <select className="input !w-auto !py-0.5 text-xs" value="" aria-label="Move to"
                          onChange={(e) => e.target.value && void move(c, e.target.value)}>
                          <option value="">Move…</option>
                          {[...QUEUE_COLUMNS, 'cancelled' as const].filter((s) => s !== c.status && allowed(s)).map((s) => <option key={s} value={s}>{QUEUE_LABELS[s]}</option>)}
                        </select>
                      </div>
                    </article>
                  );
                })}
                {list.length === 0 && <p className="px-1 text-xs text-muted">—</p>}
              </div>
            </section>
          );
        })}
      </div>

      {walkIn === 'pick' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true" aria-label="Find patient">
          <div className="card card-body w-full max-w-lg space-y-3">
            <h2>Walk-in: find the patient</h2>
            <PatientPicker autoFocus onPick={(p) => setWalkIn(p)} />
            <div className="flex justify-between">
              <Link href="/patients/new" className="btn">New patient</Link>
              <button className="btn" onClick={() => setWalkIn(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {walkIn && walkIn !== 'pick' && (
        <CheckInDialog
          patient={{ id: walkIn.id, name: `${walkIn.firstName} ${walkIn.lastName}`, medicalAidId: walkIn.medicalAidId }}
          onClose={() => setWalkIn(null)}
          onDone={(queued) => { setWalkIn(null); if (queued) setNotice('Offline — check-in saved on this device and will sync.'); void load(); }}
        />
      )}
    </div>
  );
}
