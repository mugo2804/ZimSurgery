'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, UserCircle } from 'lucide-react';
import { authClient } from '@/client/auth-client';
import { clearOfflineData } from '@/client/offline/db';
import { SyncStatus } from './SyncStatus';

type Props = { userName: string; roleLabel: string; rate: { zigPerUsd: number; isToday: boolean } | null };

export function Topbar({ userName, roleLabel, rate }: Props) {
  const router = useRouter();

  async function signOut() {
    await clearOfflineData(); // SECURITY §5: offline cache is wiped on logout
    await authClient.signOut();
    router.replace('/login');
  }

  return (
    <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface px-4 pl-14 lg:pl-6">
      <div className="flex flex-1 items-center gap-3">
        {rate ? (
          <span className={`badge ${rate.isToday ? 'badge-blue' : 'badge-amber'} num`} title={rate.isToday ? 'Exchange rate set today' : 'No rate entered today — update it in Administration'}>
            1 USD = {rate.zigPerUsd.toFixed(4)} ZiG{!rate.isToday && ' · not updated today'}
          </span>
        ) : (
          <span className="badge badge-red">No exchange rate set</span>
        )}
        <SyncStatus />
      </div>
      <Link href="/account" className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-canvas">
        <UserCircle size={22} className="text-ink-soft" aria-hidden />
        <span className="hidden text-right leading-tight sm:block">
          <span className="block text-sm font-semibold">{userName}</span>
          <span className="block text-xs text-muted">{roleLabel}</span>
        </span>
      </Link>
      <button className="btn btn-ghost" onClick={signOut} title="Sign out">
        <LogOut size={18} aria-hidden /> <span className="hidden sm:inline">Sign out</span>
      </button>
    </header>
  );
}
