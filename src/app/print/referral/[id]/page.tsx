import { requirePage, pageActor } from '@/server/session';
import { referralForPrint } from '@/server/services/clinical';
import { getPatient } from '@/server/services/patients';
import { getSettings } from '@/server/services/settings';
import { Letterhead, PatientBlock, SignatureBlock } from '../../letterhead';
import { fmtDate } from '@/lib/time';

export const metadata = { title: 'Referral letter' };

export default async function PrintReferralPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage('clinical:read');
  const { id } = await params;
  const { referral, doctor } = await referralForPrint((await pageActor(user))!, id);
  const [p, s] = await Promise.all([getPatient(referral.patientId), getSettings()]);
  return (
    <article className="text-[13px]">
      <Letterhead s={s} title="Referral" number={referral.refNo} />
      <p className="mb-3 text-sm">
        <span className="text-muted">To:</span> <strong>{[referral.toName, referral.toSpecialty, referral.toFacility].filter(Boolean).join(' · ')}</strong>
        {referral.urgency === 'urgent' && <span className="ml-2 border-2 border-ink px-2 font-black">URGENT</span>}
      </p>
      <PatientBlock p={p} date={fmtDate(referral.createdAt)} />
      <div className="whitespace-pre-wrap leading-relaxed">{referral.letter}</div>
      <SignatureBlock doctor={doctor} />
      <p className="mt-6 text-center text-[10px] text-muted">Confidential medical information — for the addressee only.</p>
    </article>
  );
}
