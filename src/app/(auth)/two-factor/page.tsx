'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/client/auth-client';

export default function TwoFactorPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = useBackup
      ? await authClient.twoFactor.verifyBackupCode({ code: code.trim() })
      : await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, '') });
    setBusy(false);
    if (res.error) setError(res.error.status === 429 ? 'Too many attempts. Wait a few minutes.' : 'That code is not valid');
    else router.replace('/dashboard');
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1>Two-factor check</h1>
      <p className="text-sm text-ink-soft">
        {useBackup ? 'Enter one of your backup codes.' : 'Enter the 6-digit code from your authenticator app.'}
      </p>
      <input className="input text-center font-mono text-lg tracking-widest" inputMode={useBackup ? 'text' : 'numeric'} autoComplete="one-time-code"
        autoFocus required value={code} onChange={(e) => setCode(e.target.value)} aria-label="Verification code" />
      {error && <p className="error-text" role="alert">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>Verify</button>
      <button type="button" className="btn btn-ghost w-full" onClick={() => { setUseBackup(!useBackup); setCode(''); }}>
        {useBackup ? 'Use authenticator code' : 'Use a backup code'}
      </button>
    </form>
  );
}
