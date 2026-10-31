import { requirePage, pageActor } from '@/server/session';
import { prescriptionForPrint } from '@/server/services/clinical';
import { getPatient } from '@/server/services/patients';
import { getSettings } from '@/server/services/settings';
import { Letterhead, PatientBlock, SignatureBlock } from '../../letterhead';
import { fmtDate } from '@/lib/time';

export const metadata = { title: 'Prescription' };

export default async function PrintRxPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage('clinical:read');
  const { id } = await params;
  const { rx, items, doctor } = await prescriptionForPrint((await pageActor(user))!, id);
  // C4: a script cannot be printed without the prescriber's registration number
  if (!doctor.hpzNumber) {
    return <p className="error-text">This prescription cannot be printed: Dr {doctor.name} has no HPZ/MDPCZ registration number on their profile. Ask the practice manager to add it.</p>;
  }
  const [p, s] = await Promise.all([getPatient(rx.patientId), getSettings()]);
  return (
    <article className="text-[13px]">
      <Letterhead s={s} title="Prescription" number={rx.rxNo} />
      <PatientBlock p={p} date={fmtDate(rx.createdAt)} />
      {p.allergyStatus === 'recorded' && <p className="mb-3 rounded border border-ink px-2 py-1 text-xs font-bold">ALLERGIES: {p.allergies.map((a) => a.substance).join(', ')}</p>}
      <p className="mb-2 text-3xl font-black italic">℞</p>
      <ol className="space-y-3">
        {items.map((i, n) => (
          <li key={i.id} className="border-b border-line-soft pb-2">
            <p className="font-bold">{n + 1}. {i.medicine} {i.strength} {i.form ? <span className="font-normal">({i.form})</span> : null}</p>
            <p>Sig: {[i.dose, i.frequency, i.duration && `for ${i.duration}`].filter(Boolean).join(', ')}{i.quantity ? ` · Qty: ${i.quantity}` : ''}</p>
            {i.instructions && <p className="text-xs">{i.instructions}</p>}
          </li>
        ))}
      </ol>
      {rx.notes && <p className="mt-3 text-xs"><strong>Notes:</strong> {rx.notes}</p>}
      <SignatureBlock doctor={doctor} />
      <p className="mt-6 text-center text-[10px] text-muted">Verify this prescription with the practice quoting {rx.rxNo}. Valid for 30 days from date of issue unless stated otherwise.</p>
    </article>
  );
}
