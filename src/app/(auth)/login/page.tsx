'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/client/auth-client';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { data, error } = await authClient.signIn.username({ username: username.trim().toLowerCase(), password });
    setBusy(false);
    if (error) {
      setError(error.status === 429 ? 'Too many attempts. Wait 15 minutes and try again.' : error.message ?? 'Incorrect username or password');
      return;
    }
    if (data && 'twoFactorRedirect' in data && data.twoFactorRedirect) router.push('/two-factor');
    else router.replace('/dashboard');
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1>Sign in</h1>
      <div>
        <label className="label" htmlFor="username">Username</label>
        <input id="username" className="input" autoComplete="username" autoFocus required value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" type="password" className="input" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="error-text" role="alert">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
