'use client';

export class ApiError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string[]>, public data?: Record<string, unknown>) {
    super(message);
  }
}

// Thin JSON fetch wrapper for online-only calls. Offline-capable writes go through
// client/offline/outbox.ts instead (Phase 6).
export async function api<T = unknown>(url: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    body: init.body ? JSON.stringify(init.body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== 'undefined' && !url.startsWith('/api/auth')) {
    window.location.href = '/login';
  }
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`, data.fields, data);
  return data as T;
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
