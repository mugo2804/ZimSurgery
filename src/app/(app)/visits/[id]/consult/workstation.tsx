'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Printer } from 'lucide-react';
import { api, errMsg } from '@/client/api';
import { fmtDateTime, fmtTime } from '@/lib/time';
import { vitalFlags } from '@/lib/reference/clinical';
import { DiagnosisPicker } from './diagnosis-picker';
import { RxBuilder } from './rx-builder';
import { LabOrderForm } from './lab-order';
import { ReferralForm } from './referral-form';
import { HistorySidebar } from './history';
import type { ConsultData, Dx, PatientLite } from './types';

const AUTOSAVE_MS = 10_000;

type Props = { visitId: string; patient: PatientLite; complaint: string | null; data: ConsultData; doctor: { name: string; hasHpz: boolean }; readOnly: boolean };

export function Workstation({ visitId, patient, complaint, data, doctor, readOnly }: Props) {
  const router = useRouter();
  const c = data.consultation;
  const [soap, setSoap] = useState({ subjective: c?.subjective ?? complaint ?? '', objective: c?.objective ?? '', assessment: c?.assessment ?? '', plan: c?.plan ?? '' });
  const [followUpDate, setFollowUpDate] = useState(c?.followUpDate ?? '');
  const [dx, setDx] = useState<Dx[]>(data.diagnoses.map((d) => ({ code: d.code, description: d.description, isPrimary: d.isPrimary })));
  const [savedAt, setSavedAt] = useState<string | null>(c?.updatedAt ?? null);
  const [saveError, setSaveError] = useState('');
  const [signed, setSigned] = useState(c?.status === 'signed');
  const [signError, setSignError] = useState('');
  const [tab, setTab] = useState<'rx' | 'lab' | 'referral'>('rx');
  const [addendum, setAddendum] = useState('');
  const dirty = useRef(false);
  const saving = useRef(false);
  const locked = signed || readOnly;

  const save = useCallback(async () => {
    if (locked || !dirty.current || saving.current) return;
    saving.current = true;
    dirty.current = false;
    try {
      const r = await api<{ savedAt: string }>(`/api/visits/${visitId}/consultation`, { method: 'PUT', body: { ...soap, followUpDate, diagnoses: dx } });
      setSavedAt(r.savedAt);
      setSaveError('');
    } catch (e) {
      dirty.current = true;
      setSaveError(`Not saved: ${errMsg(e)}`);
    } finally {
      saving.current = false;
    }
  }, [locked, visitId, soap, followUpDate, dx]);

  // Autosave every 10 s while there are unsaved changes, and before leaving the page
  useEffect(() => {
    const t = setInterval(() => void save(), AUTOSAVE_MS);
    const beforeUnload = (e: BeforeUnloadEvent) => { if (dirty.current) e.preventDefault(); };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { clearInterval(t); window.removeEventListener('beforeunload', beforeUnload); };
  }, [save]);

  const edit = (k: keyof typeof soap) => (e: React.ChangeEvent<HTMLTextAreaElement>) => { dirty.current = true; setSoap({ ...soap, [k]: e.target.value }); };
  const changeDx = (next: Dx[]) => { dirty.current = true; setDx(next); };

  async function sign() {
    setSignError('');
    dirty.current = true;
    await save();
    if (dirty.current) { setSignError('Could not save the note — check your connection and try again'); return; }
    try {
      await api(`/api/visits/${visitId}/consultation/sign`, { method: 'POST' });
      setSigned(true);
      router.refresh();
    } catch (e) { setSignError(errMsg(e)); }
  }

  async function addAddendum() {
    try {
      await api(`/api/visits/${visitId}/consultation/addenda`, { body: { text: addendum } });
      setAddendum('');
      router.refresh();
    } catch (e) { setSignError(errMsg(e)); }
  }

  const latest = data.vitals[0];
  const flags = latest ? vitalFlags(latest) : {};
  const v = (k: keyof typeof flags, val: React.ReactNode) => <span className={flags[k] === 'high' ? 'font-bold text-danger' : flags[k] === 'low' ? 'font-bold text-warn' : ''}>{val}</span>;

  const area = (k: keyof typeof soap, label: string, hint: string, rows = 4) => (
    <div>
      <label className="label" htmlFor={k}>{label}</label>
      <textarea id={k} rows={rows} className="input font-[450]" placeholder={hint} readOnly={locked} value={soap[k]} onChange={edit(k)} onBlur={() => void save()} />
    </div>
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[18rem_1fr]">
      <HistorySidebar patientId={patient.id} visitId={visitId} />

      <div className="space-y-4">
        {readOnly && <p className="rounded-md bg-warn-soft px-3 py-2 text-sm font-semibold text-warn">This consultation belongs to Dr {c?.doctorName}. You can read it but not change it.</p>}

        <section className="card">
          <div className="card-title">
            <span>Vitals {latest ? `· ${fmtTime(latest.recordedAt)}` : ''}</span>
            {!latest && <span className="text-xs font-normal text-warn">No triage recorded for this visit</span>}
          </div>
          {latest && (
            <div className="card-body flex flex-wrap gap-x-6 gap-y-1 text-sm num">
              <span>BP {v('bpSys', latest.bpSys ?? '–')}/{v('bpDia', latest.bpDia ?? '–')}</span>
              <span>Pulse {v('pulse', latest.pulse ?? '–')}</span>
              <span>RR {v('respRate', latest.respRate ?? '–')}</span>
              <span>Temp {v('tempC', latest.tempC ?? '–')}°C</span>
              <span>SpO₂ {v('spo2', latest.spo2 ?? '–')}%</span>
              <span>Wt {latest.weightKg ?? '–'} kg</span>
              <span>BMI {latest.bmi ?? '–'}</span>
              <span>Glucose {v('glucose', latest.glucose ?? '–')}</span>
              {latest.notes && <span className="w-full text-muted">Nurse: {latest.notes}</span>}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-title">
            <span className="flex items-center gap-2">SOAP note {locked && <span className="badge badge-grey"><Lock size={12} /> {signed ? `Signed ${fmtDateTime(c?.signedAt ?? new Date().toISOString())}` : 'Read only'}</span>}</span>
            <span className={`text-xs font-normal ${saveError ? 'text-danger' : 'text-muted'}`} aria-live="polite">
              {saveError || (savedAt && !locked ? `Draft saved ${fmtTime(savedAt)}` : '')}
            </span>
          </div>
          <div className="card-body grid gap-4 lg:grid-cols-2">
            {area('subjective', 'S — Subjective', 'Presenting complaint, history, systems review, medication, social history', 6)}
            {area('objective', 'O — Objective', 'Examination findings', 6)}
            <div className="space-y-2">
              <span className="label">A — Assessment (ICD-10)</span>
              <DiagnosisPicker value={dx} onChange={changeDx} disabled={locked} />
              <textarea aria-label="Assessment notes" rows={3} className="input" placeholder="Clinical reasoning, differentials" readOnly={locked}
                value={soap.assessment} onChange={edit('assessment')} onBlur={() => void save()} />
            </div>
            <div className="space-y-2">
              {area('plan', 'P — Plan', 'Treatment, advice, investigations, follow-up', 5)}
              <div className="flex items-center gap-2">
                <label className="label !mb-0" htmlFor="fu">Follow-up date</label>
                <input id="fu" type="date" className="input !w-auto" readOnly={locked} value={followUpDate}
                  onChange={(e) => { dirty.current = true; setFollowUpDate(e.target.value); }} onBlur={() => void save()} />
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="flex border-b border-line-soft text-sm font-semibold" role="tablist">
            {([['rx', `Prescriptions (${data.prescriptions.length})`], ['lab', `Lab & imaging (${data.labOrders.length})`], ['referral', `Referrals (${data.referrals.length})`]] as const).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={`px-4 py-2.5 ${tab === k ? 'border-b-2 border-brand text-brand' : 'text-ink-soft hover:text-ink'}`} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
          <div className="card-body">
            {tab === 'rx' && <RxBuilder visitId={visitId} patient={patient} existing={data.prescriptions} canPrint={doctor.hasHpz} disabled={readOnly} />}
            {tab === 'lab' && <LabOrderForm visitId={visitId} existing={data.labOrders} disabled={readOnly} />}
            {tab === 'referral' && <ReferralForm visitId={visitId} patient={patient} soap={soap} dx={dx} prescriptions={data.prescriptions} existing={data.referrals} doctorName={doctor.name} disabled={readOnly} />}
          </div>
        </section>

        {data.procedures.length > 0 && (
          <section className="card">
            <div className="card-title">Procedures this visit</div>
            <ul className="card-body space-y-1 text-sm">
              {data.procedures.map((p) => <li key={p.id}>{fmtTime(p.givenAt)} — {p.item} {p.dose ?? ''} {p.route ?? ''} {p.site ? `(${p.site})` : ''} {p.batchNo ? `· batch ${p.batchNo}` : ''}</li>)}
            </ul>
          </section>
        )}

        {signed ? (
          <section className="card">
            <div className="card-title">Addenda</div>
            <div className="card-body space-y-3">
              {data.addenda.map((a) => (
                <div key={a.id} className="rounded border border-line-soft bg-canvas p-2 text-sm">
                  <p className="whitespace-pre-wrap">{a.text}</p>
                  <p className="mt-1 text-xs text-muted">— {a.author}, {fmtDateTime(a.createdAt)}</p>
                </div>
              ))}
              {!readOnly && (
                <div className="space-y-2">
                  <textarea className="input !min-h-16" placeholder="Add a correction or later finding (the original note stays unchanged)" value={addendum} onChange={(e) => setAddendum(e.target.value)} />
                  <button className="btn" disabled={!addendum.trim()} onClick={addAddendum}>Add addendum</button>
                </div>
              )}
              <div className="flex flex-wrap gap-2 border-t border-line-soft pt-3">
                {followUpDate && <Link className="btn btn-primary" href={`/appointments?patient=${patient.id}&day=${followUpDate}`}>Book follow-up for {followUpDate}</Link>}
                <Link className="btn" href="/queue">Back to waiting room</Link>
                <Link className="btn" href={`/visits/${visitId}`}><Printer size={15} /> Visit summary</Link>
              </div>
            </div>
          </section>
        ) : !readOnly && (
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-primary" onClick={sign}><Lock size={15} /> Sign & send to billing</button>
            <span className="text-xs text-muted">Signing locks the note. Corrections after signing are added as addenda.</span>
            {signError && <p className="error-text w-full" role="alert">{signError}</p>}
          </div>
        )}
        {signed && signError && <p className="error-text">{signError}</p>}
      </div>
    </div>
  );
}
