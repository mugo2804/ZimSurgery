import { requirePage } from '@/server/session';
import { ROLE_LABELS } from '@/lib/rbac';
import { AccountClient } from './client';

export const metadata = { title: 'My account' };

export default async function AccountPage() {
  const user = await requirePage();
  return (
    <div className="max-w-2xl space-y-4">
      <h1>My account</h1>
      <div className="card card-body grid grid-cols-2 gap-2 text-sm">
        <span className="text-muted">Name</span><span>{[user.title, user.name].filter(Boolean).join(' ')}</span>
        <span className="text-muted">Username</span><span>{user.username}</span>
        <span className="text-muted">Role</span><span>{ROLE_LABELS[user.role]}</span>
        {user.hpzNumber && (<><span className="text-muted">HPZ / MDPCZ reg. no.</span><span>{user.hpzNumber}</span></>)}
      </div>
      <AccountClient twoFactorEnabled={user.twoFactorEnabled} />
    </div>
  );
}
