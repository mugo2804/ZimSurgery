import { requirePage } from '@/server/session';
import { can } from '@/lib/rbac';
import { localDay } from '@/lib/time';
import { AppointmentBook } from './book';

export const metadata = { title: 'Appointments' };

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ day?: string; patient?: string }> }) {
  const user = await requirePage('appointments:read');
  const sp = await searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.day ?? '') ? sp.day! : localDay();
  return (
    <AppointmentBook initialDay={day} preselectPatientId={sp.patient ?? null}
      canWrite={can(user.role, 'appointments:write')} canCheckIn={can(user.role, 'queue:write')} />
  );
}
