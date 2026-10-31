import { requirePage } from '@/server/session';
import { listTariffs } from '@/server/services/billing';
import { listMedicalAids } from '@/server/services/patients';
import { can } from '@/lib/rbac';
import { TariffManager } from './manager';

export const metadata = { title: 'Tariffs' };

export default async function TariffsPage() {
  const user = await requirePage('billing:read');
  const [tariffs, aids] = await Promise.all([listTariffs(true), listMedicalAids()]);
  return (
    <div className="space-y-4">
      <h1>Tariffs</h1>
      <p className="text-sm text-muted">Prices are in US dollars. The medical aid price is what the society pays; the patient pays any shortfall up to the cash price. Per-society rates override the default aid price. Seed codes are placeholders — replace them with your current AHFoZ / society schedule.</p>
      <TariffManager tariffs={tariffs} aids={aids.map((a) => ({ id: a.id, name: a.name }))} canEdit={can(user.role, 'admin:settings')} />
    </div>
  );
}
