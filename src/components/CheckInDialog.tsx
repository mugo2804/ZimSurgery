'use client';
import { useState } from 'react';
import { offlineWrite } from '@/client/offline/outbox';
import { errMsg } from '@/client/api';
import { useReference, doctorLabel } from '@/client/use-reference';

type Props = {
  patient: { id: string; name: string; medicalAidId: string | null };
  appointment?: { id: string; doctorId: string | null };
  onClose: () => void;
  onDone: (queued: boolean) => void;
};

// Check-in from an appointment or as a walk-in (FEATURES §B). Works offline via the outbox.
export function CheckInDialog({ patient, appointment, onClose, onDone }: Props) {
  const { doctors } = useReference();
  const [doctorId, setDoctorId] = useState(appointment?.doctorId ?? '');
  const [payerType, setPayerType] = useState<'cash' | 'medical_aid'>(patient.medicalAidId ? 'medical_aid' : 'cash');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [complaint, setComplaint] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await offlineWrite('/api/visits', {
        body: { id: crypto.randomUUID(), patientId: patient.id, appointmentId: appointment?.id ?? null, doctorId: doctorId || null, payerType, priority, complaint },
        label: `Check in ${patient.name}`,
      });
      onDone(res.queued);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true" aria-labelledby="checkin-title">
      <form onSubmit={submit} className="card card-body w-full max-w-md space-y-3">
        <h2 id="checkin-title">Check in {patient.name}</h2>
        <div>
          <label className="label">Doctor</label>
          <select className="input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">Next available</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{doctorLabel(d)}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Payer</label>
            <select className="input" value={payerType} onChange={(e) => setPayerType(e.target.value as 'cash' | 'medical_aid')}>
              <option value="cash">Cash</option>
              <option value="medical_aid" disabled={!patient.medicalAidId}>Medical aid</option>
            </select>
          </div>
          <div>
            <label className="label">Priority</label>
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as 'normal' | 'urgent')}>
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Presenting complaint (optional)</label>
          <input className="input" maxLength={300} value={complaint} onChange={(e) => setComplaint(e.target.value)} />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Checking in…' : 'Check in'}</button>
        </div>
      </form>
    </div>
  );
}
