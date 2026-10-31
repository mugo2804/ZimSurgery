'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api, ApiError, errMsg } from '@/client/api';
import { cachedGet } from '@/client/offline/outbox';
import { PatientPicker, type PickedPatient } from '@/components/PatientPicker';
import { CheckInDialog } from '@/components/CheckInDialog';
import { doctorLabel } from '@/client/use-reference';
import { fmtTime, localDay } from '@/lib/time';
import { useNow } from '@/client/use-now';

type Appt = {
  id: string; startAt: string; durationMin: number; reason: string | null; status: string; doctorId: string | null; patientId: string;
  firstName: string; lastName: string; fileNo: string; phone: string | null; allergyStatus: string; medicalAidId: string | null; reminderSentAt: string | null;
};
type Doctor = { id: string; name: string; title: string | null };
type Data = { day: string; appointments: Appt[]; doctors: Doctor[] };

const SLOT_MIN = 15;
const DAY_START = 7 * 60 + 30;
const DAY_END = 17 * 60 + 30;
const SLOTS = Array.from({ length: (DAY_END - DAY_START) / SLOT_MIN }, (_, i) => DAY_START + i * SLOT_MIN);
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const localMinutes = (iso: string) => { const [h, m] = fmtTime(iso).split(':').map(Number); return h * 60 + m; };
const shiftDay = (day: string, n: number) => { const d = new Date(`${day}T12:00:00+02:00`); d.setDate(d.getDate() + n); return localDay(d); };

const STATUS_BADGE: Record<string, string> = {
  booked: 'badge-blue', confirmed: 'badge-green', arrived: 'badge-green', completed: 'badge-grey', cancelled: 'badge-grey', dna: 'badge-red',
};

type Draft = { doctorId: string; time: string; durationMin: number; reason: string; patient: PickedPatient | null; editingId?: string; day: string };

export function AppointmentBook({ initialDay, preselectPatientId, canWrite, canCheckIn }: { initialDay: string; preselectPatientId: string | null; canWrite: boolean; canCheckIn: boolean }) {
  const [day, setDay] = useState(initialDay);
  const [data, setData] = useState<Data | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [overlapMsg, setOverlapMsg] = useState('');
  const [selected, setSelected] = useState<Appt | null>(null);
  const [checkIn, setCheckIn] = useState<Appt | null>(null);
  const [preselected, setPreselected] = useState<PickedPatient | null>(null);
  const now = useNow();

  const load = useCallback(async () => {
    try {
      const r = await cachedGet<Data>(`/api/appointments?day=${day}`);
      setData(r.data);
      setStale(r.stale);
      setError('');
    } catch (e) { setError(errMsg(e)); }
  }, [day]);

  useEffect(() => {
    // Fetch for the selected day; state is set after the await
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    window.history.replaceState(null, '', `/appointments?day=${day}`);
    let es: EventSource | null = null;
    if (typeof EventSource !== 'undefined') {
      es = new EventSource('/api/events/queue');
      es.addEventListener('appointments.changed', () => void load());
    }
    return () => es?.close();
  }, [day, load]);

  // Arriving from a patient file ("Book appointment")
  useEffect(() => {
    if (!preselectPatientId) return;
    api<{ patient: PickedPatient & { medicalAidName: string | null } }>(`/api/patients/${preselectPatientId}`)
      .then((r) => setPreselected({ ...r.patient, medicalAid: r.patient.medicalAidName }))
      .catch(() => {});
  }, [preselectPatientId]);

  const columns = useMemo(() => [...(data?.doctors ?? []).map((d) => ({ id: d.id, label: doctorLabel(d) })), { id: '', label: 'Any doctor' }], [data]);

  function openNew(doctorId: string, minutes: number) {
    if (!canWrite) return;
    setOverlapMsg('');
    setDraft({ doctorId, time: hhmm(minutes), durationMin: 15, reason: '', patient: preselected, day });
  }

  async function saveDraft(force = false) {
    if (!draft) return;
    setError('');
    try {
      if (draft.editingId) {
        await api(`/api/appointments/${draft.editingId}`, { method: 'PATCH', body: { action: 'reschedule', day: draft.day, time: draft.time, doctorId: draft.doctorId || null, durationMin: draft.durationMin, force } });
      } else {
        if (!draft.patient) { setError('Choose a patient'); return; }
        await api('/api/appointments', { body: { id: crypto.randomUUID(), patientId: draft.patient.id, doctorId: draft.doctorId || null, day: draft.day, time: draft.time, durationMin: draft.durationMin, reason: draft.reason, force } });
      }
      setDraft(null);
      setOverlapMsg('');
      if (draft.day !== day) setDay(draft.day); else void load();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.data?.overlap) setOverlapMsg(e.message);
      else setError(errMsg(e));
    }
  }

  async function act(a: Appt, action: 'confirm' | 'cancel' | 'dna') {
    if (action === 'cancel' && !window.confirm(`Cancel ${a.firstName} ${a.lastName}'s appointment at ${fmtTime(a.startAt)}?`)) return;
    try {
      await api(`/api/appointments/${a.id}`, { method: 'PATCH', body: { action } });
      setSelected(null);
      void load();
    } catch (e) { setError(errMsg(e)); }
  }

  const byCell = (doctorId: string, slot: number) =>
    (data?.appointments ?? []).filter((a) => (a.doctorId ?? '') === doctorId && localMinutes(a.startAt) >= slot && localMinutes(a.startAt) < slot + SLOT_MIN);
  const offGrid = (data?.appointments ?? []).filter((a) => { const m = localMinutes(a.startAt); return m < DAY_START || m >= DAY_END; });
  const nowMin = day === localDay(new Date(now)) ? localMinutes(new Date(now).toISOString()) : -1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1>Appointments</h1>
        <div className="flex items-center gap-1">
          <button className="btn" onClick={() => setDay(shiftDay(day, -1))} aria-label="Previous day"><ChevronLeft size={16} /></button>
          <input type="date" className="input !w-auto" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="Day" />
          <button className="btn" onClick={() => setDay(shiftDay(day, 1))} aria-label="Next day"><ChevronRight size={16} /></button>
          <button className="btn" onClick={() => setDay(localDay())}>Today</button>
        </div>
      </div>
      {preselected && canWrite && <p className="rounded-md bg-brand-soft px-3 py-2 text-sm text-brand-strong">Booking for <strong>{preselected.firstName} {preselected.lastName}</strong> — click a free slot.</p>}
      {stale && <p className="rounded-md bg-warn-soft px-3 py-2 text-sm font-semibold text-warn">Offline — showing the last saved diary. Booking needs the server.</p>}
      {error && <p className="error-text" role="alert">{error}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-16 border-b border-line p-2 text-left text-xs text-muted">Time</th>
              {columns.map((c) => <th key={c.id} className="border-b border-l border-line p-2 text-left">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {SLOTS.map((slot) => (
              <tr key={slot} className={slot % 60 === 0 ? 'border-t border-line' : ''}>
                <td className={`p-1 align-top font-mono text-xs ${nowMin >= slot && nowMin < slot + SLOT_MIN ? 'bg-brand-soft font-bold text-brand' : 'text-muted'}`}>{hhmm(slot)}</td>
                {columns.map((c) => {
                  const appts = byCell(c.id, slot);
                  return (
                    <td key={c.id} className="h-9 border-l border-line-soft p-0.5 align-top">
                      {appts.length ? appts.map((a) => (
                        <button key={a.id} onClick={() => setSelected(a)}
                          className={`mb-0.5 block w-full truncate rounded px-1.5 py-1 text-left text-xs ${a.status === 'cancelled' ? 'bg-line-soft text-muted line-through' : a.status === 'dna' ? 'bg-danger-soft text-danger' : 'bg-brand-soft text-brand-strong hover:bg-brand hover:text-white'}`}>
                          <strong>{fmtTime(a.startAt)}</strong> {a.lastName}, {a.firstName} {a.durationMin > 15 ? `(${a.durationMin}m)` : ''}
                        </button>
                      )) : canWrite ? (
                        <button className="h-full min-h-8 w-full rounded hover:bg-canvas" onClick={() => openNew(c.id, slot)} aria-label={`Book ${c.label} at ${hhmm(slot)}`} />
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {offGrid.length > 0 && <p className="text-sm text-muted">Outside clinic hours: {offGrid.map((a) => `${fmtTime(a.startAt)} ${a.lastName}`).join(', ')}</p>}

      {draft && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true" aria-labelledby="book-title">
          <form className="card card-body w-full max-w-lg space-y-3" onSubmit={(e) => { e.preventDefault(); void saveDraft(); }}>
            <h2 id="book-title">{draft.editingId ? 'Reschedule appointment' : 'Book appointment'}</h2>
            {!draft.editingId && (draft.patient ? (
              <p className="flex items-center justify-between rounded bg-canvas px-3 py-2 text-sm">
                <span><strong>{draft.patient.lastName}, {draft.patient.firstName}</strong> · {draft.patient.fileNo}</span>
                <button type="button" className="btn btn-sm" onClick={() => setDraft({ ...draft, patient: null })}>Change</button>
              </p>
            ) : <PatientPicker autoFocus onPick={(p) => setDraft({ ...draft, patient: p })} />)}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2"><label className="label">Doctor</label>
                <select className="input" value={draft.doctorId} onChange={(e) => setDraft({ ...draft, doctorId: e.target.value })}>
                  {columns.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div><label className="label">Date</label><input type="date" className="input" value={draft.day} onChange={(e) => setDraft({ ...draft, day: e.target.value })} required /></div>
              <div><label className="label">Time</label><input type="time" step={300} className="input" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} required /></div>
              <div><label className="label">Minutes</label>
                <select className="input" value={draft.durationMin} onChange={(e) => setDraft({ ...draft, durationMin: Number(e.target.value) })}>
                  {[10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {!draft.editingId && <div className="col-span-2 sm:col-span-3"><label className="label">Reason</label><input className="input" value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} maxLength={300} /></div>}
            </div>
            {overlapMsg && (
              <div className="rounded-md border border-warn bg-warn-soft p-3 text-sm text-warn" role="alert">
                <p className="font-semibold">{overlapMsg}</p>
                <button type="button" className="btn btn-sm mt-2" onClick={() => saveDraft(true)}>Yes, double-book</button>
              </div>
            )}
            {error && <p className="error-text">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn" onClick={() => { setDraft(null); setError(''); }}>Cancel</button>
              <button className="btn btn-primary">{draft.editingId ? 'Reschedule' : 'Book'}</button>
            </div>
          </form>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true" aria-labelledby="appt-title">
          <div className="card card-body w-full max-w-md space-y-3">
            <h2 id="appt-title">{selected.lastName}, {selected.firstName}</h2>
            <p className="text-sm">{fmtTime(selected.startAt)} · {selected.durationMin} min · {columns.find((c) => c.id === (selected.doctorId ?? ''))?.label}</p>
            {selected.reason && <p className="text-sm">{selected.reason}</p>}
            <p className="text-sm">Status: <span className={`badge ${STATUS_BADGE[selected.status]}`}>{selected.status}</span>
              {selected.reminderSentAt && <span className="ml-2 text-xs text-muted">Reminder sent</span>}</p>
            <div className="flex flex-wrap gap-2">
              <Link className="btn" href={`/patients/${selected.patientId}`}>Open file</Link>
              {canCheckIn && ['booked', 'confirmed'].includes(selected.status) && day === localDay() && (
                <button className="btn btn-primary" onClick={() => { setCheckIn(selected); setSelected(null); }}>Check in</button>
              )}
              {canWrite && selected.status === 'booked' && <button className="btn" onClick={() => act(selected, 'confirm')}>Mark confirmed</button>}
              {canWrite && ['booked', 'confirmed', 'cancelled', 'dna'].includes(selected.status) && (
                <button className="btn" onClick={() => {
                  setDraft({ doctorId: selected.doctorId ?? '', time: fmtTime(selected.startAt), durationMin: selected.durationMin, reason: '', patient: null, editingId: selected.id, day });
                  setSelected(null); setOverlapMsg('');
                }}>Reschedule</button>
              )}
              {canWrite && ['booked', 'confirmed'].includes(selected.status) && new Date(selected.startAt).getTime() < now && (
                <button className="btn" onClick={() => act(selected, 'dna')}>Did not attend</button>
              )}
              {canWrite && ['booked', 'confirmed'].includes(selected.status) && <button className="btn btn-danger" onClick={() => act(selected, 'cancel')}>Cancel</button>}
            </div>
            <div className="flex justify-end"><button className="btn" onClick={() => setSelected(null)}>Close</button></div>
          </div>
        </div>
      )}

      {checkIn && (
        <CheckInDialog
          patient={{ id: checkIn.patientId, name: `${checkIn.firstName} ${checkIn.lastName}`, medicalAidId: checkIn.medicalAidId }}
          appointment={{ id: checkIn.id, doctorId: checkIn.doctorId }}
          onClose={() => setCheckIn(null)}
          onDone={() => { setCheckIn(null); void load(); }}
        />
      )}
    </div>
  );
}
