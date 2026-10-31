import { requirePage } from '@/server/session';
import { can } from '@/lib/rbac';
import { localDay } from '@/lib/time';
import { CashupView } from './view';

export const metadata = { title: 'Cash-up' };

export default async function CashupPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const user = await requirePage('cashup:view');
  const sp = await searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.day ?? '') ? sp.day! : localDay();
  return <CashupView initialDay={day} seeAll={can(user.role, 'cashup:all')} />;
}
