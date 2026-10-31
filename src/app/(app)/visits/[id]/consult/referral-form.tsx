'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Printer } from 'lucide-react';
import { api, errMsg } from '@/client/api';
import { ageFrom } from '@/lib/validation';
import { fmtDateTime } from '@/lib/time';
import type { ConsultData, Dx, PatientLite } from './types';

type Props = {
  visitId: string; patient: PatientLite; soap: { subjective: string; objective: string; assessment: string; plan: string }; dx: Dx[];
  prescriptions: ConsultData['prescriptions']; existing: ConsultData['referrals']; doctorName: string; disabled: boolean;
};

// Letter pre-filled from the consultation (FEATURES §C — referral letters)
function draftLetter({ patient, soap, dx, prescriptions, doctorName }: Omit<Props, 'visitId' | 'existing' | 'disabled'>, specialty: string) {
  const meds = prescriptions.flatMap((r) => r.items.map((i) => `${i.medicine} ${i.strength ?? ''} ${i.dose ?? ''} ${i.frequency ?? ''}`.trim()));
  const allergies = patient.allergyStatus === 'nka' ? 'No known allergies' : patient.allergies.map((a) => `${a.substance} (${a.severity})`).join(', ') || 'Not recorded';
  return [
    `Dear Colleague${specialty ? ` (${specialty})` : ''},`,
    '',
    `Re: ${patient.firstName} ${patient.lastName}, ${ageFrom(patient.dob) ?? '?'}-year-old ${patient.sex === 'F' ? 'female' : patient.sex === 'M' ? 'male' : 'patient'}`,
    '',
    'Thank you for seeing this patient.',
    '',
    `History: ${soap.subjective || '—'}`,
    `Examination: ${soap.objective || '—'}`,
    `Working diagnosis: ${dx.map((d) => `${d.description} (${d.code})`).join('; ') || '—'}`,
    soap.assessment ? `Assessment: ${soap.assessment}` : '',
    `Current medication: ${meds.join('; ') || 'None prescribed today'}`,
    `Allergies: ${allergies}`,
    '',
    'Reason for referral: ',
    '',
    'Kind regards,',
    doctorName,
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
}

export function ReferralForm(props: Props) {
  const router = useRouter();
  const [f, setF] = useState({ toName: '', toSpecialty: '', toFacility: '', urgency: 'routine' as 'routine' | 'urgent' });
  const [letter, setLetter] = useState('');
  const [error, setError] = useState('');

  async function save() {
    setError('');
    try {
      const r = await api<{ id: string }>(`/api/visits/${props.visitId}/referrals`, { body: { ...f, letter } });
      setLetter(''); setF({ toName: '', toSpecialty: '', toFacility: '', urgency: 'routine' });
      router.refresh();
      window.open(`/print/referral/${r.id}`, '_blank', 'noopener');
    } catch (e) { setError(errMsg(e)); }
  }

  return (
    <div className="space-y-4">
      {props.existing.map((r) => (
        <div key={r.id} className="flex items-center justify-between rounded border border-line-soft p-3 text-sm">
          <span><strong>{r.refNo}</strong> · {r.toSpecialty}{r.toName ? ` — ${r.toName}` : ''} · {fmtDateTime(r.createdAt)}</span>
          <a className="btn btn-sm" href={`/print/referral/${r.id}`} target="_blank" rel="noopener"><Printer size={13} /> Print</a>
        </div>
      ))}
      {!props.disabled && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <div><label className="label">Specialty *</label><input className="input" value={f.toSpecialty} onChange={(e) => setF({ ...f, toSpecialty: e.target.value })} placeholder="Cardiology" /></div>
            <div><label className="label">To (doctor)</label><input className="input" value={f.toName} onChange={(e) => setF({ ...f, toName: e.target.value })} /></div>
            <div><label className="label">Facility</label><input className="input" value={f.toFacility} onChange={(e) => setF({ ...f, toFacility: e.target.value })} /></div>
            <div><label className="label">Urgency</label>
              <select className="input" value={f.urgency} onChange={(e) => setF({ ...f, urgency: e.target.value as 'routine' | 'urgent' })}><option value="routine">Routine</option><option value="urgent">Urgent</option></select>
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="label !mb-0">Letter</label>
              <button type="button" className="btn btn-sm" onClick={() => setLetter(draftLetter(props, f.toSpecialty))}>Draft from consultation</button>
            </div>
            <textarea className="input !min-h-64 font-mono text-xs" value={letter} onChange={(e) => setLetter(e.target.value)} />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-primary" disabled={!f.toSpecialty || letter.trim().length < 20} onClick={save}>Save & print referral</button>
        </div>
      )}
    </div>
  );
}
