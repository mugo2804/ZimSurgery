export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-xl font-black text-white">Z</div>
          <p className="text-lg font-bold">ZimMedPractice</p>
          <p className="text-sm text-muted">Electronic Health Records</p>
        </div>
        <div className="card card-body">{children}</div>
        <p className="mt-4 text-center text-xs text-muted">Authorised practice staff only. All access is logged.</p>
      </div>
    </main>
  );
}
