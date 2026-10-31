'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { authClient } from '@/client/auth-client';
import { clearOfflineData } from '@/client/offline/db';
import { startSync } from '@/client/offline/outbox';

// SECURITY §2: lock the screen after 10 minutes of inactivity; sign out entirely after 8 hours.
const LOCK_AFTER_MS = 10 * 60_000;
const SIGN_OUT_AFTER_MS = 8 * 60 * 60_000;
const LOCK_KEY = 'zimmed.lockedAt';

export function IdleLock({ username }: { username: string }) {
  // A reload must not bypass the lock
  const [locked, setLocked] = useState(() => {
    try { return typeof window !== 'undefined' && !!localStorage.getItem(LOCK_KEY); } catch { return false; }
  });
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const lastActivity = useRef(0);

  const lock = useCallback(() => {
    try { localStorage.setItem(LOCK_KEY, String(Date.now())); } catch { /* ignore */ }
    setLocked(true);
  }, []);

  useEffect(() => {
    startSync();
    lastActivity.current = Date.now();
    const touch = () => { lastActivity.current = Date.now(); };
    const events = ['mousemove', 'keydown', 'pointerdown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = setInterval(async () => {
      const idle = Date.now() - lastActivity.current;
      let lockedAt = 0;
      try { lockedAt = Number(localStorage.getItem(LOCK_KEY)) || 0; } catch { /* ignore */ }
      if (lockedAt && Date.now() - lockedAt > SIGN_OUT_AFTER_MS) {
        await clearOfflineData();
        await authClient.signOut();
        try { localStorage.removeItem(LOCK_KEY); } catch { /* ignore */ }
        window.location.href = '/login';
      } else if (!lockedAt && idle > LOCK_AFTER_MS) {
        lock();
      }
    }, 15_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(timer);
    };
  }, [lock]);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/session/unlock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }), credentials: 'same-origin',
    });
    if (res.status === 401) { window.location.href = '/login'; return; }
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Incorrect password'); return; }
    try { localStorage.removeItem(LOCK_KEY); } catch { /* ignore */ }
    lastActivity.current = Date.now();
    setPassword('');
    setLocked(false);
  }

  if (!locked) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/95 p-4" role="dialog" aria-modal="true" aria-labelledby="lock-title">
      <form onSubmit={unlock} className="card card-body w-full max-w-xs space-y-3">
        <div className="flex items-center gap-2"><Lock size={18} aria-hidden /><h2 id="lock-title">Screen locked</h2></div>
        <p className="text-sm text-ink-soft">Locked after inactivity. Enter the password for <strong>{username}</strong>.</p>
        <input type="password" className="input" autoFocus autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Password" />
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary w-full">Unlock</button>
        <button type="button" className="btn btn-ghost w-full" onClick={async () => {
          await clearOfflineData(); await authClient.signOut();
          try { localStorage.removeItem(LOCK_KEY); } catch { /* ignore */ }
          window.location.href = '/login';
        }}>Not {username}? Sign out</button>
      </form>
    </div>
  );
}
