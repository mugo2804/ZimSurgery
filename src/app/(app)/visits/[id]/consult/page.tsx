import { requirePage, pageActor } from '@/server/session';
import { getVisit } from '@/server/services/visits';
import { viewPatient } from '@/server/services/patients';
import { getConsultation } from '@/server/services/clinical';
import { PatientContext } from '@/components/PatientContext';
import { Workstation } from './workstation';

export const metadata = { title: 'Consultation' };

export default async function ConsultPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage('clinical:write');
  const { id } = await params;
  const actor = await pageActor(user);
  const visit = await getVisit(id);
  const [patient, data] = await Promise.all([viewPatient(actor, visit.patientId, 'consult'), getConsultation(actor!, id)]);
  const readOnly = !!data.consultation && data.consultation.doctorId !== user.id;
  // Dates cross the server/client boundary as ISO strings
  const plain = JSON.parse(JSON.stringify(data));
  return (
    <div className="space-y-3">
      <PatientContext p={patient} />
      <Workstation
        visitId={id}
        patient={{ id: patient.id, firstName: patient.firstName, lastName: patient.lastName, dob: patient.dob, sex: patient.sex, allergies: patient.allergies, allergyStatus: patient.allergyStatus, address: patient.address, city: patient.city }}
        complaint={visit.complaint}
        data={plain}
        doctor={{ name: user.name, hasHpz: !!user.hpzNumber }}
        readOnly={readOnly}
      />
    </div>
  );
}
