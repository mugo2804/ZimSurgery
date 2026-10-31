import { requirePage } from '@/server/session';
import { currentRate, getSetting } from '@/server/services/settings';
import { Sidebar } from '@/components/shell/Sidebar';
import { Topbar } from '@/components/shell/Topbar';
import { IdleLock } from '@/components/shell/IdleLock';
import { ROLE_LABELS } from '@/lib/rbac';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePage();
  const [rate, practiceName] = await Promise.all([currentRate(), getSetting('practice_name')]);
  const displayName = [user.title, user.name].filter(Boolean).join(' ');

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} practiceName={practiceName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          userName={displayName}
          roleLabel={ROLE_LABELS[user.role]}
          rate={rate ? { zigPerUsd: rate.zigPerUsd, isToday: rate.isToday } : null}
        />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
      <IdleLock username={user.username} />
    </div>
  );
}
