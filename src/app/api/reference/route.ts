import { route } from '@/server/api';
import { listMedicalAids } from '@/server/services/patients';
import { listDoctors } from '@/server/services/appointments';

// Small lookup lists used by forms; cached by the service worker for offline use
export const GET = route({ perm: 'patients:read' }, async () => {
  const [medicalAids, doctors] = await Promise.all([listMedicalAids(), listDoctors()]);
  return { medicalAids: medicalAids.map((a) => ({ id: a.id, name: a.name })), doctors };
});
