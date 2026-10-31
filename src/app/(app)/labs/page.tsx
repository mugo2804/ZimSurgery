import { requirePage } from '@/server/session';
import { outstandingLabs } from '@/server/services/clinical';
import { can } from '@/lib/rbac';
import { LabInbox } from './inbox';

export const metadata = { title: 'Lab results' };

export default async function LabsPage() {
  const user = await requirePage('clinical:read');
  const rows = await outstandingLabs();
  return (
    <div className="space-y-4">
      <h1>Outstanding lab & imaging orders</h1>
      <LabInbox rows={JSON.parse(JSON.stringify(rows))} canResult={can(user.role, 'labs:result')} />
    </div>
  );
}
