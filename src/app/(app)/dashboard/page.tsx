import Link from 'next/link';
import { requirePage } from '@/server/session';
import { NAV } from '@/components/shell/nav';
import { can } from '@/lib/rbac';
import { fmtDate } from '@/lib/time';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const user = await requirePage();
  const links = NAV.filter((n) => n.href !== '/dashboard' && (!n.perm || can(user.role, n.perm)));
  return (
    <div className="space-y-6">
      <div>
        <h1>Good day, {[user.title, user.name.split(' ')[0]].filter(Boolean).join(' ')}</h1>
        <p className="text-sm text-muted">{fmtDate(new Date())}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="card card-body font-semibold hover:border-brand">{l.label}</Link>
        ))}
      </div>
    </div>
  );
}
