import Link from 'next/link';
import { requirePage, pageActor } from '@/server/session';
import { patientActivity, viewPatient } from '@/server/services/patients';
import { AlertBanner } from '@/components/AlertBanner';
import { can } from '@/lib/rbac';
import { ageFrom, formatZimPhone } from '@/lib/validation';
import { fmtDate, fmtDateTime } from '@/lib/time';
import { QUEUE_LABELS } from '@/lib/schemas';
import { PatientActions } from './actions';

export const metadata = { title: 'Patient file' };

export default async function PatientFilePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage('patients:read');
  const { id } = await params;
  const p = await viewPatient(await pageActor(user), id, 'file');
  const activity = await patientActivity(id);

  const row = (label: string, value: React.ReactNode) => (
    <><dt className="text-muted">{label}</dt><dd className="font-medium">{value || '—'}</dd></>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>{p.firstName} {p.lastName}</h1>
          <p className="text-sm text-muted">
            <span className="font-mono">{p.fileNo}</span> · {p.sex ?? '?'} · {ageFrom(p.dob) ?? '?'} years{p.dob ? ` (${fmtDate(p.dob)})` : ''}
            {' · '}{p.medicalAidName ? `${p.medicalAidName} ${p.maMemberNo ?? ''} (${p.maDependantCode ?? '00'})` : 'Cash patient'}
          </p>
        </div>
        <PatientActions
          patient={{ id: p.id, name: `${p.firstName} ${p.lastName}`, medicalAidId: p.medicalAidId }}
          canEdit={can(user.role, 'patients:write')}
          canCheckIn={can(user.role, 'queue:write')}
          canBook={can(user.role, 'appointments:write')}
        />
      </div>

      <AlertBanner allergyStatus={p.allergyStatus} allergies={p.allergies} chronicConditions={p.chronicConditions} />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="card-title">Demographics & contact</div>
          <dl className="card-body grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1.5 text-sm">
            {row('National ID', <span className="font-mono">{p.nationalId}</span>)}
            {row('Mobile', formatZimPhone(p.phone))}
            {row('WhatsApp', formatZimPhone(p.whatsapp))}
            {row('Email', p.email)}
            {row('Address', [p.address, p.city].filter(Boolean).join(', '))}
            {row('Occupation', p.occupation)}
            {row('Next of kin', p.nokName ? `${p.nokName}${p.nokRelation ? ` (${p.nokRelation})` : ''} · ${formatZimPhone(p.nokPhone)}` : null)}
            {row('Communication', p.commsConsent ? `Consented · prefers ${p.preferredChannel === 'sms' ? 'SMS' : 'WhatsApp'}` : 'No consent — do not message')}
            {row('Chronic recall', p.recallIntervalMonths ? `Every ${p.recallIntervalMonths} months` : 'Off')}
          </dl>
        </section>
        <section className="card">
          <div className="card-title">Medical aid</div>
          <div className="card-body space-y-2 text-sm">
            {p.medicalAidId ? (
              <>
                <p className="font-semibold">{p.medicalAidName}</p>
                <p>Member no. <span className="font-mono">{p.maMemberNo}</span> · Dependant <span className="font-mono">{p.maDependantCode}</span></p>
                <p>Principal: {p.maPrincipalName || '—'}</p>
                {p.maVerifiedAt ? (
                  <p className="text-ok">✔ Verified {fmtDateTime(p.maVerifiedAt)} by {p.maVerifiedByName} ({p.maVerifiedMethod?.replace('_', ' ')})</p>
                ) : (
                  <p className="font-semibold text-warn">Not verified</p>
                )}
              </>
            ) : <p className="text-muted">Cash patient — no medical aid on file.</p>}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <div className="card-title">Visits</div>
          <table className="table">
            <thead><tr><th>Date</th><th>Doctor</th><th>Payer</th><th>Status</th></tr></thead>
            <tbody>
              {activity.visits.map((v) => (
                <tr key={v.id}>
                  <td className="whitespace-nowrap">{fmtDateTime(v.checkedInAt)}</td>
                  <td>{v.doctor ?? '—'}</td>
                  <td>{v.payerType === 'medical_aid' ? 'Medical aid' : 'Cash'}</td>
                  <td>
                    {can(user.role, 'clinical:read') && v.status !== 'cancelled'
                      ? <Link className="text-brand hover:underline" href={`/visits/${v.id}`}>{QUEUE_LABELS[v.status]}</Link>
                      : QUEUE_LABELS[v.status]}
                  </td>
                </tr>
              ))}
              {activity.visits.length === 0 && <tr><td colSpan={4} className="text-muted">No visits yet.</td></tr>}
            </tbody>
          </table>
        </section>
        <section className="card">
          <div className="card-title">Appointments</div>
          <table className="table">
            <thead><tr><th>When</th><th>Doctor</th><th>Reason</th><th>Status</th></tr></thead>
            <tbody>
              {activity.appointments.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap">{fmtDateTime(a.startAt)}</td>
                  <td>{a.doctor ?? 'Any'}</td>
                  <td>{a.reason ?? ''}</td>
                  <td><span className="badge badge-grey">{a.status}</span></td>
                </tr>
              ))}
              {activity.appointments.length === 0 && <tr><td colSpan={4} className="text-muted">No appointments.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
