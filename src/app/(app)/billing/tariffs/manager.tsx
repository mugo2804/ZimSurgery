'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, errMsg } from '@/client/api';
import { formatUSD } from '@/lib/money';

type T = { id: string; code: string; description: string; category: string | null; cashCents: number; aidCents: number; active: boolean; aidRates: { medicalAidId: string; aidCents: number }[] };
type Draft = { id: string | null; code: string; description: string; category: string; cashPrice: string; aidPrice: string; active: boolean; aidRates: { medicalAidId: string; price: string }[] };

const toDraft = (t?: T): Draft => t
  ? { id: t.id, code: t.code, description: t.description, category: t.category ?? '', cashPrice: (t.cashCents / 100).toFixed(2), aidPrice: (t.aidCents / 100).toFixed(2), active: t.active, aidRates: t.aidRates.map((r) => ({ medicalAidId: r.medicalAidId, price: (r.aidCents / 100).toFixed(2) })) }
  : { id: null, code: '', description: '', category: 'Consultation', cashPrice: '', aidPrice: '', active: true, aidRates: [] };

export function TariffManager({ tariffs, aids, canEdit }: { tariffs: T[]; aids: { id: string; name: string }[]; canEdit: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  async function save() {
    if (!draft) return;
    setError('');
    try {
      const body = { ...draft, cashPrice: Number(draft.cashPrice), aidPrice: Number(draft.aidPrice), aidRates: draft.aidRates.filter((r) => r.price !== '').map((r) => ({ medicalAidId: r.medicalAidId, price: Number(r.price) })) };
      await api(draft.id ? `/api/tariffs/${draft.id}` : '/api/tariffs', { method: draft.id ? 'PUT' : 'POST', body });
      setDraft(null);
      router.refresh();
    } catch (e) { setError(errMsg(e)); }
  }

  const aidName = (id: string) => aids.find((a) => a.id === id)?.name ?? '?';
  return (
    <>
      {canEdit && <button className="btn btn-primary" onClick={() => setDraft(toDraft())}>Add tariff</button>}
      <div className="card overflow-x-auto">
        <table className="table num">
          <thead><tr><th>Code</th><th>Description</th><th>Category</th><th className="text-right">Cash</th><th className="text-right">Aid (default)</th><th>Society rates</th><th /></tr></thead>
          <tbody>
            {tariffs.map((t) => (
              <tr key={t.id} className={t.active ? '' : 'opacity-50'}>
                <td className="font-mono">{t.code}</td><td>{t.description}{!t.active && ' (inactive)'}</td><td>{t.category}</td>
                <td className="text-right">{formatUSD(t.cashCents)}</td><td className="text-right">{formatUSD(t.aidCents)}</td>
                <td className="text-xs">{t.aidRates.map((r) => `${aidName(r.medicalAidId)} ${formatUSD(r.aidCents)}`).join(' · ')}</td>
                <td>{canEdit && <button className="btn btn-sm" onClick={() => setDraft(toDraft(t))}>Edit</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {draft && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-4" role="dialog" aria-modal="true" aria-labelledby="tariff-title">
          <form className="card card-body max-h-[90vh] w-full max-w-xl space-y-3 overflow-auto" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <h2 id="tariff-title">{draft.id ? 'Edit tariff' : 'New tariff'}</h2>
            <div className="grid gap-3 sm:grid-cols-4">
              <div><label className="label">Code</label><input className="input font-mono" required value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></div>
              <div className="sm:col-span-3"><label className="label">Description</label><input className="input" required value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className="label">Category</label><input className="input" list="tariff-cats" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
                <datalist id="tariff-cats">{['Consultation', 'Procedure', 'Investigation', 'Administrative', 'Medication'].map((c) => <option key={c} value={c} />)}</datalist></div>
              <div><label className="label">Cash US$</label><input type="number" step="0.01" min={0} required className="input num" value={draft.cashPrice} onChange={(e) => setDraft({ ...draft, cashPrice: e.target.value })} /></div>
              <div><label className="label">Aid US$</label><input type="number" step="0.01" min={0} required className="input num" value={draft.aidPrice} onChange={(e) => setDraft({ ...draft, aidPrice: e.target.value })} /></div>
            </div>
            <fieldset className="rounded border border-line-soft p-3">
              <legend className="label px-1">Society-specific aid rates (blank = default)</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {aids.map((a) => {
                  const r = draft.aidRates.find((x) => x.medicalAidId === a.id);
                  return (
                    <label key={a.id} className="flex items-center justify-between gap-2 text-sm">{a.name}
                      <input type="number" step="0.01" min={0} className="input !w-28 num" value={r?.price ?? ''} onChange={(e) => setDraft({
                        ...draft, aidRates: [...draft.aidRates.filter((x) => x.medicalAidId !== a.id), { medicalAidId: a.id, price: e.target.value }],
                      })} />
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Active</label>
            {error && <p className="error-text">{error}</p>}
            <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={() => setDraft(null)}>Cancel</button><button className="btn btn-primary">Save</button></div>
          </form>
        </div>
      )}
    </>
  );
}
