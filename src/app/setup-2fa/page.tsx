import { redirect } from 'next/navigation';
import { currentUser, needsMfaSetup } from '@/server/session';
import { SetupTwoFactorClient } from './client';

export const metadata = { title: 'Set up two-factor authentication' };

export default async function SetupTwoFactorPage() {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (!needsMfaSetup(user)) redirect('/dashboard');
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card card-body w-full max-w-sm space-y-3">
        <h1>Secure your account</h1>
        <p className="text-sm text-ink-soft">
          Two-factor authentication is required for your role before you can open patient records.
        </p>
        <SetupTwoFactorClient />
      </div>
    </main>
  );
}
