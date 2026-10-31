'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, errMsg } from '@/client/api';

// Creating the invoice is a POST (not a page GET) so links and prefetching can never create records
export function OpenInvoice({ visitId }: { visitId: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  useEffect(() => {
    api<{ id: string }>(`/api/visits/${visitId}/invoice`, { method: 'POST' })
      .then((r) => router.replace(`/billing/${r.id}`))
      .catch((e) => setError(errMsg(e)));
  }, [visitId, router]);
  return error ? <p className="error-text">{error}</p> : <p className="text-muted">Opening invoice…</p>;
}
