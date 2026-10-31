'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, errMsg } from '@/client/api';

export function RateForm({ current }: { current: { zigPerUsd: number; source: string | null; isToday: boolean } | null }) {
  const router = useRouter();
  const [rate, setRate] = useState('');
  const [source, setSource] = useState('RBZ interbank mid-rate');
  const [msg, setMsg] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await api('/api/exchange-rates', { body: { zigPerUsd: Number(rate), source } });
      setRate('');
      setMsg('Saved');
      router.refresh();
    } catch (err) { setMsg(errMsg(err)); }
  }

  return (
    <form onSubmit={save} className={`card card-body flex flex-wrap items-end gap-3 ${current?.isToday ? '' : 'border-2 border-warn'}`}>
      <div className="text-sm">
        <p className="font-semibold">Exchange rate</p>
        <p className={current?.isToday ? 'text-muted' : 'font-semibold text-warn'}>
          {current ? `1 USD = ${current.zigPerUsd.toFixed(4)} ZiG (${current.source ?? 'no source'})` : 'No rate set'}{current && !current.isToday ? ' — not updated today' : ''}
        </p>
      </div>
      <div><label className="label" htmlFor="rate">ZiG per 1 USD</label><input id="rate" type="number" step="0.0001" min="0" required className="input !w-36 num" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
      <div className="min-w-48 flex-1"><label className="label" htmlFor="src">Source</label><input id="src" required className="input" value={source} onChange={(e) => setSource(e.target.value)} /></div>
      <button className="btn btn-primary">Set today&apos;s rate</button>
      {msg && <span className="text-sm">{msg}</span>}
    </form>
  );
}
