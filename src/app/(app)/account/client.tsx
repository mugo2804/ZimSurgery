'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { authClient } from '@/client/auth-client';
import { offlineDb } from '@/client/offline/db';
import { discardOutboxEntry, retryOutboxEntry } from '@/client/offline/outbox';
import { TwoFactorEnroll } from '@/components/TwoFactorEnroll';
import { fmtDateTime } from '@/lib/time';

export function AccountClient({ twoFactorEnabled }: { twoFactorEnabled: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const queued = useLiveQuery(() => offlineDb()?.outbox.orderBy('seq').toArray() ?? [], [], []);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) return setMsg({ ok: false, text: 'New passwords do not match' });
    const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
    if (error) return setMsg({ ok: false, text: error.message ?? 'Could not change password' });
    setCurrent(''); setNext(''); setConfirm('');
    setMsg({ ok: true, text: 'Password changed. Other sessions were signed out.' });
  }

  return (
    <>
      <section className="card">
        <div className="card-title">Change password</div>
        <form onSubmit={changePassword} className="card-body grid gap-3 sm:grid-cols-3">
          <input type="password" className="input" placeholder="Current password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
          <input type="password" className="input" placeholder="New password (10+ chars)" autoComplete="new-password" minLength={10} required value={next} onChange={(e) => setNext(e.target.value)} />
          <input type="password" className="input" placeholder="Repeat new password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <div className="flex items-center gap-3 sm:col-span-3">
            <button className="btn btn-primary">Update password</button>
            {msg && <span className={msg.ok ? 'text-sm text-ok' : 'error-text'}>{msg.text}</span>}
          </div>
        </form>
      </section>

      <section className="card">
        <div className="card-title">Two-factor authentication</div>
        <div className="card-body space-y-3 text-sm">
          {twoFactorEnabled ? (
            <p><span className="badge badge-green">On</span> Your account asks for an authenticator code at sign-in. To move to a new phone, ask the practice manager to reset 2FA.</p>
          ) : enrolling ? (
            <div className="max-w-sm"><TwoFactorEnroll onDone={() => { setEnrolling(false); router.refresh(); }} /></div>
          ) : (
            <>
              <p><span className="badge badge-amber">Off</span> Strongly recommended for everyone with access to patient records.</p>
              <button className="btn btn-primary" onClick={() => setEnrolling(true)}>Set up two-factor</button>
            </>
          )}
        </div>
      </section>

      <section className="card" id="sync">
        <div className="card-title">Changes waiting to sync on this device</div>
        <div className="card-body">
          {queued.length === 0 ? (
            <p className="text-sm text-muted">Nothing waiting — everything recorded on this device has reached the server.</p>
          ) : (
            <table className="table">
              <thead><tr><th>Recorded</th><th>Change</th><th>Status</th><th /></tr></thead>
              <tbody>
                {queued.map((q) => (
                  <tr key={q.seq}>
                    <td className="whitespace-nowrap">{fmtDateTime(new Date(q.createdAt))}</td>
                    <td>{q.label}</td>
                    <td>{q.status === 'conflict' ? <span className="badge badge-red" title={q.error}>Rejected: {q.error}</span> : <span className="badge badge-amber">Waiting{q.attempts ? ` (${q.attempts} retries)` : ''}</span>}</td>
                    <td className="whitespace-nowrap text-right">
                      {q.status === 'conflict' && <button className="btn btn-sm" onClick={() => retryOutboxEntry(q.seq!)}>Retry</button>}{' '}
                      <button className="btn btn-sm" onClick={() => { if (window.confirm(`Discard "${q.label}"? It will not be saved.`)) void discardOutboxEntry(q.seq!); }}>Discard</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
