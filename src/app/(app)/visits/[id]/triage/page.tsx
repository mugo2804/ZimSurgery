import { requirePage, pageActor } from '@/server/session';
import { getVisit } from '@/server/services/visits';
import { viewPatient } from '@/server/services/patients';
import { listStockItems } from '@/server/services/stock';
import { PatientContext } from '@/components/PatientContext';
import { TriageForm } from './form';

export const metadata = { title: 'Triage' };

export default async function TriagePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage('vitals:write');
  const { id } = await params;
  const visit = await getVisit(id);
  const [patient, stock] = await Promise.all([viewPatient(await pageActor(user), visit.patientId, 'triage'), listStockItems()]);
  return (
    <div className="max-w-5xl space-y-4">
      <PatientContext p={patient} />
      {visit.complaint && <p className="text-sm"><span className="font-semibold">Presenting complaint:</span> {visit.complaint}</p>}
      <TriageForm visitId={id} stock={stock.map((s) => ({ id: s.id, name: s.name, qty: s.qty, batchNo: s.batchNo }))} />
    </div>
  );
}
