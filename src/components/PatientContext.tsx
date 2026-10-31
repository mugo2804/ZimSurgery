import Link from 'next/link';
import { AlertBanner } from './AlertBanner';
import { ageFrom } from '@/lib/validation';
import type { getPatient } from '@/server/services/patients';

type P = Awaited<ReturnType<typeof getPatient>>;

// Patient identity strip + alert banner for every patient-context screen (FEATURES A3)
export function PatientContext({ p, right }: { p: P; right?: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex flex-wrap items-baseline gap-2">
            <Link href={`/patients/${p.id}`} className="hover:underline">{p.firstName} {p.lastName}</Link>
            <span className="text-sm font-normal text-muted">{p.sex ?? '?'} · {ageFrom(p.dob) ?? '?'}y · <span className="font-mono">{p.fileNo}</span></span>
          </h1>
          <p className="text-xs text-muted">{p.medicalAidName ? `${p.medicalAidName} · ${p.maMemberNo}` : 'Cash patient'}</p>
        </div>
        {right}
      </div>
      <AlertBanner allergyStatus={p.allergyStatus} allergies={p.allergies} chronicConditions={p.chronicConditions} compact />
    </div>
  );
}
