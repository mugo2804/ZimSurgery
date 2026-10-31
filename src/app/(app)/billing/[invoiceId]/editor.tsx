'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Printer, Trash2 } from 'lucide-react';
import { api, errMsg } from '@/client/api';
import { formatUSD, formatZiG, formatMoney, priceLines, toCents, usdToZigCents, zigToUsdCents, METHOD_CURRENCIES, PAYMENT_METHOD_LABELS } from '@/lib/money';
import { fmtDateTime } from '@/lib/time';
import { TENDER_METHODS } from '@/lib/billing-schemas';
import type { getInvoice } from '@/server/services/billing';

type Jsonify<T> = T extends Date ? string : T extends (infer U)[] ? Jsonify<U>[] : T extends object ? { [K in keyof T]: Jsonify<T[K]> } : T;
type Invoice = Jsonify<Awaited<ReturnType<typeof getInvoice>>>;
type Tariff = { id: string; code: string; description: string; category: string | null; cashCents: number; aidCents: number };
type Line = { tariffId: string | null; code: string | null; description: string; icd10: string | null; qty: number; unitPrice?: string };
type Tender = { method: (typeof TENDER_METHODS)[number]; currency: 'USD' | 'ZiG'; amount: string; reference: string };

const STATUS: Record<string, string> = { open: 'badge-amber', partially_paid: 'badge-amber', paid: 'badge-green', void: 'badge-grey' };

export function InvoiceEditor({ invoice, tariffs, rate, canWrite, canVoid }: { invoice: Invoice; tariffs: Tariff[]; rate: { zigPerUsd: number; isToday: boolean } | null; canWrite: boolean; canVoid: boolean }) {
  const router = useRouter();
  const aid = invoice.payerType === 'medical_aid';
  const primaryDx = invoice.diagnosisCodes.find((d) => d.isPrimary)?.code ?? invoice.diagnosisCodes[0]?.code ?? null;
  const editable = canWrite && invoice.status === 'open' && invoice.paidCents === 0 && ['none', 'pending'].includes(invoice.claimStatus);
  const [lines, setLines] = useState<Line[]>(invoice.items.map((i) => ({ tariffId: i.tariffId, code: i.code, description: i.description, icd10: i.icd10, qty: i.qty, unitPrice: i.tariffId ? undefined : (i.unitCents / 100).toFixed(2) })));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [tenders, setTenders] = useState<Tender[]>([{ method: 'usd_cash', currency: 'USD', amount: '', reference: '' }]);
  const [result, setResult] = useState<{ receiptNo: string; change: { currency: 'USD' | 'ZiG'; amountMinor: number } | null } | null>(null);
  const [busy, setBusy] = useState(false);

  // Live preview using the same pricing rules as the server
  const preview = useMemo(() => priceLines(lines.map((l) => {
    const t = tariffs.find((x) => x.id === l.tariffId);
    return { qty: l.qty, unitCents: t ? t.cashCents : toCents(l.unitPrice || 0), aidUnitCents: t ? t.aidCents : 0 };
  }), invoice.payerType), [lines, tariffs, invoice.payerType]);

  const setLine = (i: number, patch: Partial<Line>) => { setDirty(true); setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l))); };
  const addTariff = (t: Tariff) => { setDirty(true); setLines([...lines, { tariffId: t.id, code: t.code, description: t.description, icd10: primaryDx, qty: 1 }]); };

  async function saveItems() {
    setError('');
    try {
      await api(`/api/invoices/${invoice.id}/items`, { method: 'PUT', body: { items: lines.map((l) => ({ ...l, unitPrice: l.tariffId ? undefined : Number(l.unitPrice || 0) })) } });
      setDirty(false);
      router.refresh();
    } catch (e) { setError(errMsg(e)); }
  }

  const balance = dirty ? preview.patientCents : invoice.balanceCents;
  const tenderUsd = (t: Tender) => {
    const minor = toCents(t.amount || 0);
    return t.currency === 'USD' ? minor : rate ? zigToUsdCents(minor, rate.zigPerUsd) : 0;
  };
  const tendered = tenders.reduce((s, t) => s + tenderUsd(t), 0);
  const remaining = balance - tendered;
  const lastCash = [...tenders].reverse().find((t) => t.method === 'usd_cash' || t.method === 'zig_cash');
  // Same rule as the server: change = cash tendered − what that tender must cover, in its own currency
  const changeMinor = (() => {
    if (remaining >= 0 || !lastCash) return 0;
    const neededUsd = balance - (tendered - tenderUsd(lastCash));
    if (neededUsd < 0) return 0;
    const neededMinor = lastCash.currency === 'USD' ? neededUsd : rate ? usdToZigCents(neededUsd, rate.zigPerUsd) : 0;
    return toCents(lastCash.amount || 0) - neededMinor;
  })();

  async function pay() {
    setBusy(true);
    setError('');
    try {
      const r = await api<{ receiptNo: string; change: { currency: 'USD' | 'ZiG'; amountMinor: number } | null }>(`/api/invoices/${invoice.id}/payments`, {
        body: { tenders: tenders.filter((t) => Number(t.amount) > 0).map((t) => ({ ...t, amount: Number(t.amount), reference: t.reference || null })) },
      });
      setResult(r);
      setTenders([{ method: 'usd_cash', currency: 'USD', amount: '', reference: '' }]);
      router.refresh();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  async function voidIt() {
    const reason = window.prompt('Reason for voiding this invoice:');
    if (!reason) return;
    try { await api(`/api/invoices/${invoice.id}/void`, { body: { reason } }); router.refresh(); } catch (e) { setError(errMsg(e)); }
  }

  const zig = (cents: number) => (rate ? <span className="text-xs text-muted"> ≈ {formatZiG(usdToZigCents(cents, rate.zigPerUsd))}</span> : null);
  const categories = [...new Set(tariffs.map((t) => t.category ?? 'Other'))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2">Invoice <span className="font-mono">{invoice.invoiceNo}</span> <span className={`badge ${STATUS[invoice.status]}`}>{invoice.status.replace('_', ' ')}</span>
            {invoice.claimStatus !== 'none' && <span className="badge badge-blue">claim {invoice.claimStatus}</span>}</h1>
          <p className="text-sm text-muted">
            <Link className="text-brand hover:underline" href={`/patients/${invoice.patient.id}`}>{invoice.patient.firstName} {invoice.patient.lastName}</Link> · {invoice.patient.fileNo} ·{' '}
            {aid ? `${invoice.medicalAidName} · ${invoice.memberNo} (${invoice.dependantCode ?? '00'})` : 'Cash patient'} · {fmtDateTime(invoice.createdAt)}
          </p>
          {invoice.voidReason && <p className="text-sm font-semibold text-danger">Void: {invoice.voidReason}</p>}
        </div>
        <div className="flex gap-2">
          <a className="btn" href={`/print/receipt/${invoice.id}`} target="_blank" rel="noopener"><Printer size={15} /> {invoice.paidCents > 0 ? 'Receipt' : 'Invoice'}</a>
          {canVoid && invoice.status !== 'void' && invoice.paidCents === 0 && <button className="btn btn-danger" onClick={voidIt}>Void</button>}
        </div>
      </div>

      {aid && invoice.diagnosisCodes.length === 0 && <p className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">No diagnosis recorded for this visit — ICD-10 codes are required on medical aid lines. Enter them manually or ask the doctor.</p>}

      <section className="card">
        <div className="card-title">Items {dirty && <span className="text-xs font-normal text-warn">Unsaved changes</span>}</div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Code</th><th>Description</th><th>ICD-10</th><th className="w-20">Qty</th><th className="text-right">Unit</th>{aid && <th className="text-right">Aid pays</th>}<th className="text-right">Total</th><th /></tr></thead>
            <tbody className="num">
              {lines.map((l, i) => {
                const t = tariffs.find((x) => x.id === l.tariffId);
                const p = preview.lines[i];
                return (
                  <tr key={i}>
                    <td className="font-mono">{l.code ?? '—'}</td>
                    <td>{t ? l.description : <input className="input !py-1" disabled={!editable} value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} aria-label="Description" />}</td>
                    <td>
                      <input className="input !w-24 !py-1 font-mono" list="dx-codes" disabled={!editable} value={l.icd10 ?? ''} onChange={(e) => setLine(i, { icd10: e.target.value.toUpperCase() || null })} aria-label="ICD-10" />
                    </td>
                    <td><input type="number" min={1} max={100} className="input !py-1" disabled={!editable} value={l.qty} onChange={(e) => setLine(i, { qty: Math.max(1, Number(e.target.value)) })} aria-label="Quantity" /></td>
                    <td className="text-right">{t ? formatUSD(t.cashCents) : <input type="number" step="0.01" min={0} className="input !w-24 !py-1 text-right" disabled={!editable} value={l.unitPrice ?? ''} onChange={(e) => setLine(i, { unitPrice: e.target.value })} aria-label="Unit price" />}</td>
                    {aid && <td className="text-right">{formatUSD(p?.aidTotalCents ?? 0)}</td>}
                    <td className="text-right font-semibold">{formatUSD(p?.totalCents ?? 0)}</td>
                    <td>{editable && <button className="btn btn-ghost btn-sm" aria-label="Remove line" onClick={() => { setDirty(true); setLines(lines.filter((_, j) => j !== i)); }}><Trash2 size={14} /></button>}</td>
                  </tr>
                );
              })}
              {lines.length === 0 && <tr><td colSpan={8} className="text-muted">No items yet — add from the tariff list below.</td></tr>}
            </tbody>
            <tfoot className="num">
              <tr><td colSpan={aid ? 6 : 5} className="text-right font-semibold">Total</td><td className="text-right font-bold">{formatUSD(preview.totalCents)}{zig(preview.totalCents)}</td><td /></tr>
              {aid && <tr><td colSpan={6} className="text-right">Medical aid portion</td><td className="text-right">{formatUSD(preview.aidCents)}</td><td /></tr>}
              <tr><td colSpan={aid ? 6 : 5} className="text-right font-semibold">{aid ? 'Patient shortfall' : 'Patient pays'}</td><td className="text-right text-lg font-black">{formatUSD(preview.patientCents)}{zig(preview.patientCents)}</td><td /></tr>
            </tfoot>
          </table>
          <datalist id="dx-codes">{invoice.diagnosisCodes.map((d) => <option key={d.code} value={d.code}>{d.description}</option>)}</datalist>
        </div>
        {editable && (
          <div className="card-body space-y-3 border-t border-line-soft">
            {categories.map((c) => (
              <div key={c} className="flex flex-wrap items-center gap-1.5">
                <span className="w-28 text-xs font-bold uppercase text-ink-soft">{c}</span>
                {tariffs.filter((t) => (t.category ?? 'Other') === c).map((t) => (
                  <button key={t.id} className="btn btn-sm" onClick={() => addTariff(t)} title={`${t.code} · cash ${formatUSD(t.cashCents)} · aid ${formatUSD(t.aidCents)}`}>
                    <Plus size={12} /> {t.description}
                  </button>
                ))}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-sm" onClick={() => { setDirty(true); setLines([...lines, { tariffId: null, code: null, description: 'Other item', icd10: primaryDx, qty: 1, unitPrice: '' }]); }}><Plus size={12} /> Ad-hoc item</button>
              <button className="btn btn-primary" disabled={!dirty} onClick={saveItems}>Save items</button>
            </div>
          </div>
        )}
      </section>

      {error && <p className="error-text" role="alert">{error}</p>}

      {result && (
        <div className="card card-body flex flex-wrap items-center justify-between gap-2 border-2 border-ok bg-ok-soft" role="status">
          <p className="font-semibold text-ok">Payment recorded · receipt {result.receiptNo}{result.change ? ` · CHANGE DUE: ${formatMoney(result.change.amountMinor, result.change.currency)}` : ''}</p>
          <a className="btn" href={`/print/receipt/${invoice.id}`} target="_blank" rel="noopener"><Printer size={15} /> Print receipt</a>
        </div>
      )}

      {canWrite && invoice.status !== 'void' && !dirty && invoice.balanceCents > 0 && (
        <section className="card">
          <div className="card-title">Take payment · balance {formatUSD(invoice.balanceCents)}{zig(invoice.balanceCents)}</div>
          <div className="card-body space-y-3">
            {!rate?.isToday && <p className="text-sm text-warn">Today&apos;s exchange rate has not been set{rate ? ` — ZiG will convert at ${rate.zigPerUsd.toFixed(4)}` : ' — ZiG payments are unavailable'}.</p>}
            {tenders.map((t, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[12rem_6rem_9rem_1fr_auto]">
                <select className="input" value={t.method} aria-label="Method" onChange={(e) => {
                  const method = e.target.value as Tender['method'];
                  setTenders(tenders.map((x, j) => (j === i ? { ...x, method, currency: METHOD_CURRENCIES[method][0] } : x)));
                }}>
                  {TENDER_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
                </select>
                <select className="input" value={t.currency} aria-label="Currency" onChange={(e) => setTenders(tenders.map((x, j) => (j === i ? { ...x, currency: e.target.value as 'USD' | 'ZiG' } : x)))}>
                  {METHOD_CURRENCIES[t.method].map((c) => <option key={c} disabled={c === 'ZiG' && !rate}>{c}</option>)}
                </select>
                <input type="number" step="0.01" min={0} className="input text-right num" placeholder="Amount" aria-label="Amount" value={t.amount}
                  onChange={(e) => setTenders(tenders.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
                <input className="input" placeholder={t.method.endsWith('cash') ? 'Reference (optional)' : 'Transaction / approval ref.'} aria-label="Reference" value={t.reference}
                  onChange={(e) => setTenders(tenders.map((x, j) => (j === i ? { ...x, reference: e.target.value } : x)))} />
                <button className="btn btn-ghost" aria-label="Remove tender" disabled={tenders.length === 1} onClick={() => setTenders(tenders.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn btn-sm" onClick={() => setTenders([...tenders, { method: 'ecocash', currency: 'USD', amount: '', reference: '' }])}><Plus size={12} /> Split payment</button>
              <button className="btn btn-sm" onClick={() => {
                const last = tenders[tenders.length - 1];
                const due = Math.max(0, remaining + tenderUsd(last));
                const amt = last.currency === 'USD' ? due : rate ? usdToZigCents(due, rate.zigPerUsd) : 0;
                setTenders(tenders.map((x, j) => (j === tenders.length - 1 ? { ...x, amount: (amt / 100).toFixed(2) } : x)));
              }}>Fill balance</button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded bg-canvas p-3 num">
              <span>Tendered: <strong>{formatUSD(tendered)}</strong></span>
              {remaining > 0 ? <span className="text-warn">Still owing: <strong>{formatUSD(remaining)}</strong> (part payment)</span>
                : remaining < 0 ? (changeMinor > 0 ? <span className="text-lg font-black text-ok">Change: {formatMoney(changeMinor, lastCash!.currency)}</span> : <span className="text-danger">Overpayment only allowed with cash</span>)
                : <span className="font-semibold text-ok">Exact</span>}
              <button className="btn btn-primary" disabled={busy || tendered <= 0 || (remaining < 0 && !changeMinor)} onClick={pay}>{busy ? 'Recording…' : 'Record payment'}</button>
            </div>
          </div>
        </section>
      )}

      {invoice.payments.length > 0 && (
        <section className="card">
          <div className="card-title">Payments</div>
          <table className="table num">
            <thead><tr><th>Receipt</th><th>When</th><th>Method</th><th className="text-right">Amount</th><th className="text-right">USD equiv.</th><th>Ref.</th><th>By</th></tr></thead>
            <tbody>{invoice.payments.map((p) => (
              <tr key={p.id}><td className="font-mono">{p.receiptNo}</td><td>{fmtDateTime(p.receivedAt)}</td><td>{PAYMENT_METHOD_LABELS[p.method]}</td>
                <td className="text-right">{formatMoney(p.amountMinor, p.currency)}{p.zigRate ? <span className="block text-xs text-muted">@ {Number(p.zigRate).toFixed(4)}</span> : null}</td>
                <td className="text-right">{formatUSD(p.usdCents)}</td><td>{p.reference ?? ''}</td><td>{p.receivedByName ?? ''}</td></tr>
            ))}</tbody>
          </table>
        </section>
      )}
    </div>
  );
}
