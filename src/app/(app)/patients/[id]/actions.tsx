'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckInDialog } from '@/components/CheckInDialog';
import { api, errMsg } from '@/client/api';

type Props = {
  patient: { id: string; name: string; medicalAidId: string | null };
  canEdit: boolean; canCheckIn: boolean; canBook: boolean;
};

export function PatientActions({ patient, canEdit, canCheckIn, canBook }: Props) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [method, setMethod] = useState('phone');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  async function verify() {
    setError('');
    try {
      await api(`/api/patients/${patient.id}/verify-aid`, { body: { method, note } });
      setVerifying(false);
      router.refresh();
    } catch (e) { setError(errMsg(e)); }
  }

  return (
    <div className="no-print flex flex-wrap gap-2">
      {canCheckIn && <button className="btn btn-primary" onClick={() => setCheckIn(true)}>Check in</button>}
      {canBook && <Link className="btn" href={`/appointments?patient=${patient.id}`}>Book appointment</Link>}
      {canEdit && patient.medicalAidId && <button className="btn" onClick={() => setVerifying(!verifying)}>Verify medical aid</button>}
      {canEdit && <Link className="btn" href={`/patients/${patient.id}/edit`}>Edit details</Link>}

      {verifying && (
        <div className="card card-body w-full space-y-2 sm:w-96">
          <p className="text-sm font-semibold">Record medical aid verification</p>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Verification method">
            <option value="phone">Phoned the society</option>
            <option value="portal">Society web portal</option>
            <option value="card_swipe">Card swipe terminal</option>
            <option value="email">Email confirmation</option>
          </select>
          <input className="input" placeholder="Reference / note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          {error && <p className="error-text">{error}</p>}
          <div className="flex gap-2"><button className="btn btn-primary" onClick={verify}>Save verification</button><button className="btn" onClick={() => setVerifying(false)}>Cancel</button></div>
        </div>
      )}
      {checkIn && (
        <CheckInDialog patient={patient} onClose={() => setCheckIn(false)} onDone={() => { setCheckIn(false); router.push('/queue'); }} />
      )}
    </div>
  );
}
