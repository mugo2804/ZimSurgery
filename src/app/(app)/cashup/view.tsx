'use client';
import { useCallback, useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { api, errMsg } from '@/client/api';
import { formatMoney, formatUSD, formatZiG, PAYMENT_METHOD_LABELS, toCents } from '@/lib/money';
import { fmtDateTime } from '@/lib/time';

type Summary = {
  day: string;
  lines: { method: string; currency: 'USD' | 'ZiG'; amountMinor: number; usdCents: number; count: number }[];
  cashiers: { id: string | null; name: string | null }[];
  totalUsdEquivalent: number; expectedUsdCash: number; expectedZigCash: number;
  declarations: { id: string; createdAt: string; declaredUsdCents: number; declaredZigCents: number; variance: { usd: number; zig: number }; notes: string | null; createdByName: string | null; cashierId: string | null }[];
};

const signed = (n: number, f: (c: number) => string) => (n === 0 ? 'Balanced' : `${n > 0 ? 'Over' : 'Short'} ${f(Math.abs(n))}`);

export function CashupView({ initialDay, seeAll }: { initialDay: string; seeAll: boolean }) {
  const [day, setDay] = useState(initialDay);
  const [cashierId, setCashierId] = useState('');
  const [s, setS] = useState<Summary | null>(null);
  const [usd, setUsd] = useState('');
  const [zig, setZig] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setS(await api<Summary>(`/api/cashup?day=${day}${cashierId ? `&cashierId=${cashierId}` : ''}`)); setError(''); } catch (e) { setError(errMsg(e)); }
  }, [day, cashierId]);
  // Fetch for the selected day; state is set after the await
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function declare(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/api/cashup', { body: { day, cashierId: cashierId || null, declaredUsd: Number(usd || 0), declaredZig: Number(zig || 0), notes } });
      setUsd(''); setZig(''); setNotes('');
      void load();
    } catch (err) { setError(errMsg(err)); }
  }

  const liveUsd = usd === '' ? null : toCents(usd) - (s?.expectedUsdCash ?? 0);
  const liveZig = zig === '' ? null : toCents(zig) - (s?.expectedZigCash ?? 0);

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1>End-of-day cash-up</h1>
        <div className="flex flex-wrap gap-2">
          <input type="date" className="input !w-auto" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="Day" />
          {seeAll && (
            <select className="input !w-auto" value={cashierId} onChange={(e) => setCashierId(e.target.value)} aria-label="Cashier">
              <option value="">All cashiers</option>
              {s?.cashiers.map((c) => <option key={c.id ?? 'x'} value={c.id ?? ''}>{c.name}</option>)}
            </select>
          )}
          <a className="btn" href={`/print/cashup?day=${day}${cashierId ? `&cashierId=${cashierId}` : ''}`} target="_blank" rel="noopener"><Printer size={15} /> Print</a>
        </div>
      </div>
      {!seeAll && <p className="text-sm text-muted">Showing your own takings.</p>}
      {error && <p className="error-text">{error}</p>}
      {s && (<>
        <section className="card">
          <div className="card-title">Collections by method</div>
          <table className="table num">
            <thead><tr><th>Method</th><th>Currency</th><th className="text-right">Transactions</th><th className="text-right">Amount</th><th className="text-right">USD equivalent</th></tr></thead>
            <tbody>
              {s.lines.map((l) => (
                <tr key={`${l.method}${l.currency}`}><td>{PAYMENT_METHOD_LABELS[l.method]}</td><td>{l.currency}</td><td className="text-right">{l.count}</td>
                  <td className="text-right font-semibold">{formatMoney(l.amountMinor, l.currency)}</td><td className="text-right">{formatUSD(l.usdCents)}</td></tr>
              ))}
              {s.lines.length === 0 && <tr><td colSpan={5} className="text-muted">No payments taken on this day.</td></tr>}
            </tbody>
            <tfoot><tr><td colSpan={4} className="text-right font-bold">Total (USD equivalent)</td><td className="text-right font-black">{formatUSD(s.totalUsdEquivalent)}</td></tr></tfoot>
          </table>
          <p className="px-4 pb-3 text-xs text-muted">Medical aid remittances are excluded — they are reconciled under Claims.</p>
        </section>

        <form onSubmit={declare} className="card">
          <div className="card-title">Count the drawer</div>
          <div className="card-body grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm">Expected USD cash: <strong className="num">{formatUSD(s.expectedUsdCash)}</strong></p>
              <label className="label mt-2" htmlFor="usd">Counted USD cash</label>
              <input id="usd" type="number" step="0.01" min={0} className="input text-lg num" value={usd} onChange={(e) => setUsd(e.target.value)} />
              {liveUsd !== null && <p className={`mt-1 text-sm font-semibold ${liveUsd === 0 ? 'text-ok' : 'text-danger'}`}>{signed(liveUsd, formatUSD)}</p>}
            </div>
            <div>
              <p className="text-sm">Expected ZiG cash: <strong className="num">{formatZiG(s.expectedZigCash)}</strong></p>
              <label className="label mt-2" htmlFor="zig">Counted ZiG cash</label>
              <input id="zig" type="number" step="0.01" min={0} className="input text-lg num" value={zig} onChange={(e) => setZig(e.target.value)} />
              {liveZig !== null && <p className={`mt-1 text-sm font-semibold ${liveZig === 0 ? 'text-ok' : 'text-danger'}`}>{signed(liveZig, formatZiG)}</p>}
            </div>
            <div className="sm:col-span-2"><label className="label">Notes (explain any variance)</label><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <div className="sm:col-span-2"><button className="btn btn-primary" disabled={usd === '' && zig === ''}>Submit cash-up</button></div>
          </div>
        </form>

        {s.declarations.length > 0 && (
          <section className="card">
            <div className="card-title">Submitted cash-ups</div>
            <table className="table num">
              <thead><tr><th>When</th><th>By</th><th className="text-right">USD counted</th><th>USD variance</th><th className="text-right">ZiG counted</th><th>ZiG variance</th><th>Notes</th></tr></thead>
              <tbody>{s.declarations.map((d) => (
                <tr key={d.id}><td>{fmtDateTime(d.createdAt)}</td><td>{d.createdByName}</td><td className="text-right">{formatUSD(d.declaredUsdCents)}</td>
                  <td className={d.variance.usd ? 'text-danger' : 'text-ok'}>{signed(d.variance.usd, formatUSD)}</td><td className="text-right">{formatZiG(d.declaredZigCents)}</td>
                  <td className={d.variance.zig ? 'text-danger' : 'text-ok'}>{signed(d.variance.zig, formatZiG)}</td><td>{d.notes}</td></tr>
              ))}</tbody>
            </table>
          </section>
        )}
      </>)}
    </div>
  );
}
