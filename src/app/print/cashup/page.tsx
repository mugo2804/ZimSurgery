import { requirePage, pageActor } from '@/server/session';
import { cashupSummary } from '@/server/services/billing';
import { getSettings } from '@/server/services/settings';
import { audit } from '@/server/audit';
import { Letterhead } from '../letterhead';
import { can } from '@/lib/rbac';
import { formatMoney, formatUSD, formatZiG, PAYMENT_METHOD_LABELS } from '@/lib/money';
import { fmtDate, fmtDateTime, localDay } from '@/lib/time';

export const metadata = { title: 'Cash-up report' };

export default async function PrintCashupPage({ searchParams }: { searchParams: Promise<{ day?: string; cashierId?: string }> }) {
  const user = await requirePage('cashup:view');
  const sp = await searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.day ?? '') ? sp.day! : localDay();
  const cashierId = can(user.role, 'cashup:all') ? sp.cashierId || null : user.id;
  const [s, settings] = await Promise.all([cashupSummary(day, cashierId), getSettings()]);
  await audit(await pageActor(user), { action: 'billing.cashup_print', details: { day, cashierId } });
  const last = s.declarations[0];
  return (
    <article className="text-[13px]">
      <Letterhead s={settings} title="Daily cash-up" number={fmtDate(`${day}T12:00:00+02:00`)} />
      <p className="mb-3 text-sm">Cashier: <strong>{cashierId ? s.cashiers.find((c) => c.id === cashierId)?.name ?? user.name : 'All cashiers'}</strong> · Printed {fmtDateTime(new Date())} by {user.name}</p>
      <table className="w-full text-sm num">
        <thead><tr className="border-b-2 border-ink text-left"><th>Method</th><th>Currency</th><th className="text-right">Count</th><th className="text-right">Amount</th><th className="text-right">USD equiv.</th></tr></thead>
        <tbody>{s.lines.map((l) => (
          <tr key={`${l.method}${l.currency}`} className="border-b border-line-soft"><td className="py-1">{PAYMENT_METHOD_LABELS[l.method]}</td><td>{l.currency}</td><td className="text-right">{l.count}</td>
            <td className="text-right">{formatMoney(l.amountMinor, l.currency as "USD" | "ZiG")}</td><td className="text-right">{formatUSD(l.usdCents)}</td></tr>
        ))}</tbody>
        <tfoot><tr><td colSpan={4} className="pt-2 text-right font-bold">Total</td><td className="pt-2 text-right font-black">{formatUSD(s.totalUsdEquivalent)}</td></tr></tfoot>
      </table>
      <section className="mt-6 grid grid-cols-2 gap-6 text-sm num">
        <div><p>Expected USD cash: <strong>{formatUSD(s.expectedUsdCash)}</strong></p>{last && <p>Counted: {formatUSD(last.declaredUsdCents)} · Variance {formatUSD(last.variance.usd)}</p>}</div>
        <div><p>Expected ZiG cash: <strong>{formatZiG(s.expectedZigCash)}</strong></p>{last && <p>Counted: {formatZiG(last.declaredZigCents)} · Variance {formatZiG(last.variance.zig)}</p>}</div>
      </section>
      <footer className="mt-12 grid grid-cols-2 gap-10 text-sm">
        <div><div className="mb-1 h-8 border-b border-ink" />Cashier signature</div>
        <div><div className="mb-1 h-8 border-b border-ink" />Practice manager signature</div>
      </footer>
    </article>
  );
}
