import { requirePage } from '@/server/session';
import { PatientForm } from '@/components/PatientForm';

export const metadata = { title: 'Register patient' };

export default async function NewPatientPage() {
  await requirePage('patients:write');
  return (
    <div className="max-w-5xl space-y-4">
      <h1>Register patient</h1>
      <PatientForm />
    </div>
  );
}
