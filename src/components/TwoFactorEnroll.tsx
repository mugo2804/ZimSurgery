'use client';
import { useState } from 'react';
import QRCode from 'qrcode';
import { authClient } from '@/client/auth-client';

// TOTP enrolment: password → QR (rendered locally, the secret never leaves the browser/server) → confirm code → backup codes
export function TwoFactorEnroll({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<'password' | 'scan' | 'codes'>('password');
  const [password, setPassword] = useState('');
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { data, error } = await authClient.twoFactor.enable({ password });
    setBusy(false);
    if (error || !data || data.method !== 'totp') return setError(error?.message ?? 'Could not start enrolment');
    setQr(await QRCode.toDataURL(data.totpURI, { margin: 1, width: 220 }));
    setSecret(new URL(data.totpURI).searchParams.get('secret') ?? '');
    setBackupCodes(data.backupCodes);
    setStep('scan');
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, '') });
    setBusy(false);
    if (error) return setError('That code is not valid — check the time on your phone and try again');
    setStep('codes');
  }

  if (step === 'password') {
    return (
      <form onSubmit={start} className="space-y-3">
        <p className="text-sm text-ink-soft">Install a free authenticator app (Google Authenticator, Microsoft Authenticator, Aegis or 2FAS), then confirm your password.</p>
        <input type="password" className="input" placeholder="Current password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>Continue</button>
      </form>
    );
  }
  if (step === 'scan') {
    return (
      <form onSubmit={confirm} className="space-y-3">
        <p className="text-sm text-ink-soft">Scan this code with your authenticator app, then enter the 6-digit code it shows.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="Authenticator QR code" className="mx-auto rounded border border-line" width={220} height={220} />
        <p className="break-all text-center font-mono text-xs text-muted">Manual key: {secret}</p>
        <input className="input text-center font-mono text-lg tracking-widest" inputMode="numeric" autoComplete="one-time-code" required
          value={code} onChange={(e) => setCode(e.target.value)} aria-label="6-digit code" />
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>Confirm</button>
      </form>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-ok">Two-factor authentication is on.</p>
      <p className="text-sm text-ink-soft">Write down these backup codes and keep them somewhere safe. Each works once if you lose your phone.</p>
      <ul className="grid grid-cols-2 gap-1 rounded border border-line bg-canvas p-3 font-mono text-sm">
        {backupCodes.map((c) => <li key={c}>{c}</li>)}
      </ul>
      <button className="btn btn-primary w-full" onClick={onDone}>I have saved my codes</button>
    </div>
  );
}
