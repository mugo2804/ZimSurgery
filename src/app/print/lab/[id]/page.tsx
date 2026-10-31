import { requirePage, pageActor } from '@/server/session';
import { labOrderForPrint } from '@/server/services/clinical';
import { getPatient } from '@/server/services/patients';
import { getSettings } from '@/server/services/settings';
import { Letterhead, PatientBlock, SignatureBlock } from '../../letterhead';
import { fmtDate } from '@/lib/time';

export const metadata = { title: 'Lab requisition' };

export default async function PrintLabPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage('clinical:read');
  const { id } = await params;
  const { order, doctor } = await labOrderForPrint((await pageActor(user))!, id);
  const [p, s] = await Promise.all([getPatient(order.patientId), getSettings()]);
  return (
    <article className="text-[13px]">
      <Letterhead s={s} title="Laboratory / Imaging Request" number={order.orderNo} />
      <p className="mb-3 text-sm"><span className="text-muted">To:</span> <strong>{order.lab}</strong> {order.urgency === 'urgent' && <span className="ml-2 border-2 border-ink px-2 font-black">URGENT</span>}</p>
      <PatientBlock p={p} date={fmtDate(order.createdAt)} />
      <h2 className="mb-1 text-sm font-bold uppercase">Tests requested</h2>
      <ul className="mb-4 grid grid-cols-2 gap-1">{order.tests.map((t) => <li key={t}>☑ {t}</li>)}</ul>
      <h2 className="mb-1 text-sm font-bold uppercase">Clinical information</h2>
      <p className="min-h-16 whitespace-pre-wrap rounded border border-line p-2">{order.clinicalInfo || '—'}</p>
      <p className="mt-3 text-xs">Please send results to the requesting doctor at {s.practice_email || s.practice_phone}.</p>
      <SignatureBlock doctor={doctor} />
    </article>
  );
}
