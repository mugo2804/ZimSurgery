import Link from 'next/link';

export const metadata = { title: 'Not permitted' };

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card card-body max-w-md space-y-3 text-center">
        <h1>Not permitted</h1>
        <p className="text-sm text-ink-soft">Your role does not have access to this page. If you need it, ask the practice manager.</p>
        <Link href="/dashboard" className="btn btn-primary">Back to dashboard</Link>
      </div>
    </main>
  );
}
