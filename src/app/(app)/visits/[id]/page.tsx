import { Fragment } from 'react';
import Link from 'next/link';
import { Printer } from 'lucide-react';
import { requirePage, pageActor } from '@/server/session';
import { getVisit } from '@/server/services/visits';
import { viewPatient } from '@/server/services/patients';
import { getConsultation } from '@/server/services/clinical';
import { PatientContext } from '@/components/PatientContext';
import { can } from '@/lib/rbac';
import { fmtDateTime, fmtTime } from '@/lib/time';
import { QUEUE_LABELS } from '@/lib/schemas';

export const metadata = { title: 'Visit' };

// Read-only clinical summary of one visit (nurses and doctors)
export default async function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage('clinical:read');
  const { id } = await params;
  const actor = await pageActor(user);
  const visit = await getVisit(id);
  const [patient, data] = await Promise.all([viewPatient(actor, visit.patientId, 'visit'), getConsultation(actor!, id)]);
  const c = data.consultation;
  const section = (title: string, body: React.ReactNode) => (
    <section className="card"><div className="card-title">{title}</div><div className="card-body text-sm">{body}</div></section>
  );
  return (
    <div className="max-w-5xl space-y-4">
      <PatientContext p={patient} right={
        <div className="no-print flex gap-2">
          {can(user.role, 'vitals:write') && visit.status !== 'completed' && <Link className="btn" href={`/visits/${id}/triage`}>Triage</Link>}
          {can(user.role, 'clinical:write') && (!c || c.doctorId === user.id) && <Link className="btn btn-primary" href={`/visits/${id}/consult`}>{c ? 'Open consultation' : 'Start consultation'}</Link>}
        </div>
      } />
      <p className="text-sm text-muted">Visit {fmtDateTime(visit.checkedInAt)} · {QUEUE_LABELS[visit.status]} · {visit.doctorName ? `Dr ${visit.doctorName}` : 'No doctor assigned'} · {visit.payerType === 'medical_aid' ? 'Medical aid' : 'Cash'}</p>

      {section('Vitals', data.vitals.length ? (
        <ul className="space-y-1 num">{data.vitals.map((v) => (
          <li key={v.id}>{fmtTime(v.recordedAt)} — BP {v.bpSys ?? '–'}/{v.bpDia ?? '–'}, P {v.pulse ?? '–'}, RR {v.respRate ?? '–'}, T {v.tempC ?? '–'}°C, SpO₂ {v.spo2 ?? '–'}%, Wt {v.weightKg ?? '–'}kg, BMI {v.bmi ?? '–'}, Glu {v.glucose ?? '–'}{v.notes ? ` · ${v.notes}` : ''}</li>
        ))}</ul>
      ) : <p className="text-muted">No vitals recorded.</p>)}

      {c ? section(`Consultation — Dr ${c.doctorName}${c.status === 'signed' ? ` · signed ${fmtDateTime(c.signedAt)}` : ' · DRAFT'}`, (
        <dl className="grid gap-3 sm:grid-cols-[8rem_1fr]">
          <dt className="font-semibold">Subjective</dt><dd className="whitespace-pre-wrap">{c.subjective || '—'}</dd>
          <dt className="font-semibold">Objective</dt><dd className="whitespace-pre-wrap">{c.objective || '—'}</dd>
          <dt className="font-semibold">Assessment</dt>
          <dd>
            <ul>{data.diagnoses.map((d) => <li key={d.id}><span className="font-mono font-semibold">{d.code}</span> {d.description}{d.isPrimary ? ' (primary)' : ''}</li>)}</ul>
            {c.assessment && <p className="mt-1 whitespace-pre-wrap">{c.assessment}</p>}
          </dd>
          <dt className="font-semibold">Plan</dt><dd className="whitespace-pre-wrap">{c.plan || '—'}{c.followUpDate ? `\nFollow-up: ${c.followUpDate}` : ''}</dd>
          {data.addenda.map((a) => (<Fragment key={a.id}><dt className="font-semibold">Addendum</dt><dd className="whitespace-pre-wrap">{a.text} <span className="text-xs text-muted">— {a.author}, {fmtDateTime(a.createdAt)}</span></dd></Fragment>))}
        </dl>
      )) : section('Consultation', <p className="text-muted">Not started.</p>)}

      {data.prescriptions.length > 0 && section('Prescriptions', data.prescriptions.map((rx) => (
        <div key={rx.id} className="mb-2 flex items-start justify-between gap-2">
          <div><strong>{rx.rxNo}</strong><ul className="list-disc pl-5">{rx.items.map((i) => <li key={i.id}>{i.medicine} {i.strength} — {i.dose} {i.frequency}{i.duration ? ` × ${i.duration}` : ''}</li>)}</ul></div>
          <a className="btn btn-sm no-print" href={`/print/rx/${rx.id}`} target="_blank" rel="noopener"><Printer size={13} /> Print</a>
        </div>
      )))}
      {data.labOrders.length > 0 && section('Lab & imaging', data.labOrders.map((o) => (
        <div key={o.id} className="mb-2">
          <div className="flex justify-between"><span><strong>{o.orderNo}</strong> {o.lab} — {o.tests.join(', ')} <span className="badge badge-grey">{o.status.replace('_', ' ')}</span></span>
            <a className="btn btn-sm no-print" href={`/print/lab/${o.id}`} target="_blank" rel="noopener"><Printer size={13} /> Print</a></div>
          {o.result && <p className="mt-1 whitespace-pre-wrap rounded bg-ok-soft p-2">{o.result}</p>}
        </div>
      )))}
      {data.referrals.length > 0 && section('Referrals', data.referrals.map((r) => (
        <div key={r.id} className="flex justify-between"><span><strong>{r.refNo}</strong> {r.toSpecialty}{r.toName ? ` — ${r.toName}` : ''}</span>
          <a className="btn btn-sm no-print" href={`/print/referral/${r.id}`} target="_blank" rel="noopener"><Printer size={13} /> Print</a></div>
      )))}
      {data.procedures.length > 0 && section('Procedures', <ul>{data.procedures.map((p) => <li key={p.id}>{fmtTime(p.givenAt)} — {p.item} {p.dose ?? ''} {p.route ?? ''} {p.site ?? ''} {p.batchNo ? `· batch ${p.batchNo}` : ''}</li>)}</ul>)}
    </div>
  );
}
