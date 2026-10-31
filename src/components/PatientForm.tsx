'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { offlineWrite } from '@/client/offline/outbox';
import { ApiError, errMsg } from '@/client/api';
import { useReference } from '@/client/use-reference';
import { CHRONIC_CONDITIONS, RECALL_DEFAULTS } from '@/lib/reference/clinical';
import { SEVERITIES, type PatientInput } from '@/lib/schemas';
import type { DuplicateMatch } from '@/server/services/patients';

type Allergy = { substance: string; reaction?: string | null; severity: (typeof SEVERITIES)[number] };
type FormState = Omit<PatientInput, 'allergies'> & { allergies: Allergy[] };

const blank: FormState = {
  firstName: '', lastName: '', dob: '', sex: undefined, nationalId: '', phone: '', whatsapp: '', email: '', address: '', city: 'Harare',
  occupation: '', nokName: '', nokPhone: '', nokRelation: '', medicalAidId: '', maMemberNo: '', maPrincipalName: '', maDependantCode: '00',
  allergyStatus: 'unknown', allergies: [], chronicConditions: [], recallIntervalMonths: 0, commsConsent: true, preferredChannel: 'whatsapp',
};

export function PatientForm({ initial, patientId }: { initial?: Partial<FormState>; patientId?: string }) {
  const router = useRouter();
  const { medicalAids } = useReference();
  const [f, setF] = useState<FormState>({ ...blank, ...initial });
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [busy, setBusy] = useState(false);
  const [newCondition, setNewCondition] = useState('');

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const input = (k: keyof FormState) => ({
    value: (f[k] as string | null | undefined) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(k, e.target.value as never),
    'aria-invalid': fields[k] ? true : undefined,
  });
  const fieldError = (k: string) => fields[k]?.[0] && <p className="mt-1 text-xs font-medium text-danger">{fields[k][0]}</p>;

  function addCondition(c: string) {
    const name = c.trim();
    if (!name || f.chronicConditions?.includes(name)) return;
    setF((s) => {
      const suggested = RECALL_DEFAULTS[name];
      const recall = suggested && (!s.recallIntervalMonths || suggested < Number(s.recallIntervalMonths)) ? suggested : s.recallIntervalMonths;
      return { ...s, chronicConditions: [...(s.chronicConditions ?? []), name], recallIntervalMonths: recall };
    });
    setNewCondition('');
  }

  async function save(confirmDuplicate = false) {
    setBusy(true);
    setError('');
    setFields({});
    const id = patientId ?? (f.id || crypto.randomUUID());
    if (!patientId) set('id', id);
    const body = { ...f, id: patientId ? undefined : id, confirmDuplicate };
    try {
      const res = await offlineWrite<{ id: string }>(patientId ? `/api/patients/${patientId}` : '/api/patients', {
        method: patientId ? 'PUT' : 'POST', body, label: `${patientId ? 'Update' : 'Register'} patient ${f.firstName} ${f.lastName}`,
      });
      if (res.queued) {
        alert('The practice server is unreachable. This registration is saved on this device and will sync automatically.');
        router.push('/patients');
      } else {
        router.push(`/patients/${res.data.id}`);
        router.refresh();
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && Array.isArray(e.data?.duplicates)) {
        setDuplicates(e.data.duplicates as DuplicateMatch[]);
      } else {
        setError(errMsg(e));
        if (e instanceof ApiError && e.fields) setFields(e.fields);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-4">
      <section className="card">
        <div className="card-title">Identity</div>
        <div className="card-body grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><label className="label" htmlFor="pf-1">First name *</label><input id="pf-1" className="input" required {...input('firstName')} />{fieldError('firstName')}</div>
          <div><label className="label" htmlFor="pf-2">Surname *</label><input id="pf-2" className="input" required {...input('lastName')} />{fieldError('lastName')}</div>
          <div><label className="label" htmlFor="pf-3">Date of birth</label><input id="pf-3" type="date" className="input" max={new Date().toISOString().slice(0, 10)} {...input('dob')} />{fieldError('dob')}</div>
          <div><label className="label">Sex</label>
            <select className="input" {...input('sex')}><option value="">—</option><option value="F">Female</option><option value="M">Male</option><option value="O">Other</option></select>
          </div>
          <div><label className="label" htmlFor="pf-4">National ID</label><input id="pf-4" className="input font-mono" placeholder="63-123456 F 42" {...input('nationalId')} />{fieldError('nationalId')}</div>
          <div><label className="label" htmlFor="pf-5">Occupation</label><input id="pf-5" className="input" {...input('occupation')} /></div>
        </div>
      </section>

      <section className="card">
        <div className="card-title">Contact & residence</div>
        <div className="card-body grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><label className="label" htmlFor="pf-6">Mobile</label><input id="pf-6" className="input" inputMode="tel" placeholder="0772 123 456" {...input('phone')} />{fieldError('phone')}</div>
          <div><label className="label" htmlFor="pf-7">WhatsApp (if different)</label><input id="pf-7" className="input" inputMode="tel" {...input('whatsapp')} />{fieldError('whatsapp')}</div>
          <div className="sm:col-span-2"><label className="label" htmlFor="pf-8">Email</label><input id="pf-8" type="email" className="input" {...input('email')} />{fieldError('email')}</div>
          <div className="sm:col-span-2 lg:col-span-3"><label className="label" htmlFor="pf-9">Physical address (proof of residence)</label><input id="pf-9" className="input" {...input('address')} /></div>
          <div><label className="label" htmlFor="pf-10">City / town</label><input id="pf-10" className="input" {...input('city')} /></div>
        </div>
      </section>

      <section className="card">
        <div className="card-title">Next of kin / emergency contact</div>
        <div className="card-body grid gap-3 sm:grid-cols-3">
          <div><label className="label" htmlFor="pf-11">Name</label><input id="pf-11" className="input" {...input('nokName')} /></div>
          <div><label className="label" htmlFor="pf-12">Relationship</label><input id="pf-12" className="input" placeholder="Spouse, parent…" {...input('nokRelation')} /></div>
          <div><label className="label" htmlFor="pf-13">Phone</label><input id="pf-13" className="input" inputMode="tel" {...input('nokPhone')} />{fieldError('nokPhone')}</div>
        </div>
      </section>

      <section className="card">
        <div className="card-title">Medical aid</div>
        <div className="card-body grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><label className="label">Society</label>
            <select className="input" {...input('medicalAidId')}>
              <option value="">None — cash patient</option>
              {medicalAids.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          {f.medicalAidId && (<>
            <div><label className="label" htmlFor="pf-14">Membership no. *</label><input id="pf-14" className="input font-mono" {...input('maMemberNo')} />{fieldError('maMemberNo')}</div>
            <div><label className="label" htmlFor="pf-15">Principal member</label><input id="pf-15" className="input" {...input('maPrincipalName')} /></div>
            <div><label className="label" htmlFor="pf-16">Dependant code</label><input id="pf-16" className="input font-mono" maxLength={2} placeholder="00" {...input('maDependantCode')} />{fieldError('maDependantCode')}</div>
          </>)}
        </div>
      </section>

      <section className="card">
        <div className="card-title">Clinical alerts</div>
        <div className="card-body space-y-4">
          <fieldset>
            <legend className="label">Allergy status</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              {([['unknown', 'Not yet asked'], ['nka', 'No known allergies'], ['recorded', 'Allergies recorded']] as const).map(([v, l]) => (
                <label key={v} className="flex items-center gap-1.5">
                  <input type="radio" name="allergyStatus" checked={f.allergyStatus === v} onChange={() => {
                    setF((s) => ({ ...s, allergyStatus: v, allergies: v === 'recorded' ? (s.allergies.length ? s.allergies : [{ substance: '', severity: 'moderate' }]) : [] }));
                  }} /> {l}
                </label>
              ))}
            </div>
            {fieldError('allergyStatus')}{fieldError('allergies')}
          </fieldset>
          {f.allergyStatus === 'recorded' && (
            <div className="space-y-2">
              {f.allergies.map((a, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_10rem_auto]">
                  <input className="input" placeholder="Substance (e.g. Penicillin, Sulfa)" value={a.substance} aria-label="Allergy substance"
                    onChange={(e) => set('allergies', f.allergies.map((x, j) => (j === i ? { ...x, substance: e.target.value } : x)))} />
                  <input className="input" placeholder="Reaction (e.g. rash)" value={a.reaction ?? ''} aria-label="Reaction"
                    onChange={(e) => set('allergies', f.allergies.map((x, j) => (j === i ? { ...x, reaction: e.target.value } : x)))} />
                  <select className="input" value={a.severity} aria-label="Severity"
                    onChange={(e) => set('allergies', f.allergies.map((x, j) => (j === i ? { ...x, severity: e.target.value as Allergy['severity'] } : x)))}>
                    {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button type="button" className="btn btn-ghost" aria-label="Remove allergy" onClick={() => set('allergies', f.allergies.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
                </div>
              ))}
              <button type="button" className="btn btn-sm" onClick={() => set('allergies', [...f.allergies, { substance: '', severity: 'moderate' }])}><Plus size={14} /> Add allergy</button>
            </div>
          )}

          <div>
            <span className="label">Chronic conditions</span>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {(f.chronicConditions ?? []).map((c) => (
                <button type="button" key={c} className="badge badge-amber" onClick={() => set('chronicConditions', f.chronicConditions!.filter((x) => x !== c))} title="Remove">
                  {c} ✕
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="input max-w-xs" list="chronic-list" placeholder="Add condition" value={newCondition}
                onChange={(e) => setNewCondition(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCondition(newCondition); } }} />
              <datalist id="chronic-list">{CHRONIC_CONDITIONS.map((c) => <option key={c} value={c} />)}</datalist>
              <button type="button" className="btn" onClick={() => addCondition(newCondition)}>Add</button>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-title">Communication</div>
        <div className="card-body grid gap-3 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!f.commsConsent} onChange={(e) => set('commsConsent', e.target.checked)} />
            Patient consents to reminders by WhatsApp/SMS
          </label>
          <div><label className="label">Preferred channel</label>
            <select className="input" {...input('preferredChannel')}><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option></select>
          </div>
          <div><label className="label">Chronic recall every (months, 0 = off)</label>
            <input type="number" min={0} max={24} className="input" value={Number(f.recallIntervalMonths ?? 0)} onChange={(e) => set('recallIntervalMonths', Number(e.target.value))} />
          </div>
        </div>
      </section>

      {duplicates.length > 0 && (
        <div className="card border-2 border-warn bg-warn-soft p-4" role="alert">
          <p className="font-bold text-warn">Possible duplicate — this patient may already be registered:</p>
          <ul className="my-2 list-disc pl-5 text-sm">
            {duplicates.map((d) => (
              <li key={d.id}><Link className="font-semibold underline" href={`/patients/${d.id}`}>{d.name}</Link> · {d.fileNo} · {d.reason}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={() => setDuplicates([])}>Go back and check</button>
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => save(true)}>It is a different person — save anyway</button>
          </div>
        </div>
      )}

      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : patientId ? 'Save changes' : 'Register patient'}</button>
        <button type="button" className="btn" onClick={() => router.back()}>Cancel</button>
      </div>
    </form>
  );
}
