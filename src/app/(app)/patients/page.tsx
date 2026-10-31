import Link from 'next/link';
import { requirePage } from '@/server/session';
import { searchPatients } from '@/server/services/patients';
import { can } from '@/lib/rbac';
import { ageFrom, formatZimPhone } from '@/lib/validation';
import { PatientSearchBox } from './search-box';

export const metadata = { title: 'Patients' };

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requirePage('patients:read');
  const { q = '' } = await searchParams;
  const rows = await searchPatients(q.slice(0, 100), 50);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1>Patients</h1>
        {can(user.role, 'patients:write') && <Link href="/patients/new" className="btn btn-primary">Register patient</Link>}
      </div>
      <PatientSearchBox initial={q} />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>File no.</th><th>Name</th><th>Age/Sex</th><th>National ID</th><th>Phone</th><th>Medical aid</th><th>Alerts</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="font-mono text-xs">{p.fileNo}</td>
                <td><Link href={`/patients/${p.id}`} className="font-semibold text-brand hover:underline">{p.lastName}, {p.firstName}</Link></td>
                <td>{ageFrom(p.dob) ?? '—'} {p.sex ?? ''}</td>
                <td className="font-mono text-xs">{p.nationalId ?? '—'}</td>
                <td className="whitespace-nowrap">{formatZimPhone(p.phone) || '—'}</td>
                <td>{p.medicalAid ? `${p.medicalAid} · ${p.maMemberNo ?? ''}` : <span className="text-muted">Cash</span>}</td>
                <td className="space-x-1">
                  {p.allergies.some((a) => a.severity === 'severe' || a.severity === 'anaphylaxis') && <span className="badge badge-red">Severe allergy</span>}
                  {p.allergyStatus === 'unknown' && <span className="badge badge-amber">Allergies ?</span>}
                  {p.chronicConditions.length > 0 && <span className="badge badge-amber">{p.chronicConditions.length} chronic</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-muted">No patients found{q ? ` for “${q}”` : ''}.</td></tr>}
          </tbody>
        </table>
      </div>
      {!q && <p className="text-xs text-muted">Showing the 50 most recently updated patients. Search to find others.</p>}
    </div>
  );
}
