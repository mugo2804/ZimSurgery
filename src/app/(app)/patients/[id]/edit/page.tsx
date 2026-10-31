import { requirePage, pageActor } from '@/server/session';
import { viewPatient } from '@/server/services/patients';
import { PatientForm } from '@/components/PatientForm';

export const metadata = { title: 'Edit patient' };

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage('patients:write');
  const { id } = await params;
  const p = await viewPatient(await pageActor(user), id, 'edit');
  return (
    <div className="max-w-5xl space-y-4">
      <h1>Edit {p.firstName} {p.lastName} <span className="font-mono text-sm text-muted">{p.fileNo}</span></h1>
      <PatientForm patientId={p.id} initial={{
        firstName: p.firstName, lastName: p.lastName, dob: p.dob ?? '', sex: p.sex ?? undefined, nationalId: p.nationalId ?? '',
        phone: p.phone ?? '', whatsapp: p.whatsapp && p.whatsapp !== p.phone ? p.whatsapp : '', email: p.email ?? '', address: p.address ?? '',
        city: p.city ?? '', occupation: p.occupation ?? '', nokName: p.nokName ?? '', nokPhone: p.nokPhone ?? '', nokRelation: p.nokRelation ?? '',
        medicalAidId: p.medicalAidId ?? '', maMemberNo: p.maMemberNo ?? '', maPrincipalName: p.maPrincipalName ?? '', maDependantCode: p.maDependantCode ?? '00',
        allergyStatus: p.allergyStatus, allergies: p.allergies, chronicConditions: p.chronicConditions, recallIntervalMonths: p.recallIntervalMonths,
        commsConsent: p.commsConsent, preferredChannel: p.preferredChannel,
      }} />
    </div>
  );
}
