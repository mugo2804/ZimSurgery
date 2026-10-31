'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export function PatientSearchBox({ initial }: { initial: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  useEffect(() => {
    if (q === initial) return;
    const t = setTimeout(() => router.replace(q.trim() ? `/patients?q=${encodeURIComponent(q.trim())}` : '/patients'), 300);
    return () => clearTimeout(t);
  }, [q, initial, router]);
  return (
    <div className="relative max-w-xl">
      <Search size={16} className="pointer-events-none absolute left-2.5 top-2.5 text-muted" aria-hidden />
      <input className="input pl-8" autoFocus placeholder="Search by name, file no., national ID, phone or medical aid no." value={q}
        onChange={(e) => setQ(e.target.value)} aria-label="Search patients" />
    </div>
  );
}
