'use client';
import { offlineDb, cacheGet, cachePut, type OutboxEntry } from './db';
import { ApiError } from '../api';

// Offline outbox (docs/ARCHITECTURE.md §4). Offline-capable writes carry client UUIDs and an
// Idempotency-Key, so replaying them after an outage can never create duplicates.

const LAST_SYNC_KEY = 'zimmed.lastSync';
const listeners = new Set<() => void>();
export const onSyncChange = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const notify = () => listeners.forEach((fn) => fn());

export function getLastSync(): number | null {
  try { return Number(localStorage.getItem(LAST_SYNC_KEY)) || null; } catch { return null; }
}
function markSynced() {
  try { localStorage.setItem(LAST_SYNC_KEY, String(Date.now())); } catch { /* storage unavailable */ }
  notify();
}

const isNetworkFailure = (e: unknown) => e instanceof TypeError; // fetch rejects with TypeError when the server is unreachable
const isRetryableStatus = (s: number) => s >= 500 || s === 408 || s === 429;

async function send(method: string, url: string, body: unknown, idemKey: string) {
  return fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idemKey },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  });
}

export type WriteResult<T> = { queued: false; data: T } | { queued: true };

/** Write that succeeds immediately when online, or is queued for replay when the server is unreachable. */
export async function offlineWrite<T = unknown>(url: string, opts: { method?: 'POST' | 'PUT' | 'PATCH'; body: unknown; label: string }): Promise<WriteResult<T>> {
  const method = opts.method ?? 'POST';
  const idemKey = crypto.randomUUID();
  try {
    const res = await send(method, url, opts.body, idemKey);
    const data = await res.json().catch(() => ({}));
    if (res.ok) { markSynced(); return { queued: false, data: data as T }; }
    if (!isRetryableStatus(res.status)) throw new ApiError(res.status, data.error ?? 'Request failed', data.fields, data);
  } catch (e) {
    if (!isNetworkFailure(e)) throw e;
  }
  const outbox = offlineDb()?.outbox;
  if (!outbox) throw new ApiError(0, 'Offline and this browser cannot store changes');
  await outbox.add({ idemKey, method, url, body: opts.body, label: opts.label, createdAt: Date.now(), status: 'pending', attempts: 0 });
  notify();
  return { queued: true };
}

let flushing = false;

/** Replay queued writes in order. Stops at the first network failure to preserve ordering. */
export async function flushOutbox(): Promise<void> {
  const d = offlineDb();
  if (!d || flushing || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  const run = async () => {
    flushing = true;
    try {
      const pending = await d.outbox.where('status').equals('pending').sortBy('seq');
      for (const entry of pending) {
        if (!(await replay(entry))) break;
      }
    } finally {
      flushing = false;
      notify();
    }
  };
  // Only one tab replays at a time
  if ('locks' in navigator) await navigator.locks.request('zimmed-outbox', { ifAvailable: true }, (lock) => (lock ? run() : undefined));
  else await run();
}

async function replay(entry: OutboxEntry): Promise<boolean> {
  const d = offlineDb()!;
  try {
    const res = await send(entry.method, entry.url, entry.body, entry.idemKey);
    if (res.ok) {
      await d.outbox.delete(entry.seq!);
      markSynced();
      return true;
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) return false; // signed out — keep queued until the user signs back in
    if (isRetryableStatus(res.status)) {
      await d.outbox.update(entry.seq!, { attempts: entry.attempts + 1, error: data.error });
      return false;
    }
    // Validation/permission/conflict: needs a human — park it and carry on with the rest
    await d.outbox.update(entry.seq!, { status: 'conflict', error: data.error ?? `HTTP ${res.status}` });
    return true;
  } catch {
    return false;
  }
}

export async function discardOutboxEntry(seq: number) {
  await offlineDb()?.outbox.delete(seq);
  notify();
}

export async function retryOutboxEntry(seq: number) {
  await offlineDb()?.outbox.update(seq, { status: 'pending', error: undefined });
  notify();
  await flushOutbox();
}

let started = false;
export function startSync() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => void flushOutbox());
  setInterval(() => void flushOutbox(), 30_000);
  void flushOutbox();
}

/** GET that falls back to the last cached copy when offline. `stale` tells the UI to show a banner. */
export async function cachedGet<T>(url: string, opts: { cache?: boolean } = { cache: true }): Promise<{ data: T; stale: boolean; at: number }> {
  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { window.location.href = '/login'; throw new ApiError(401, 'Signed out'); }
    if (!res.ok) throw new ApiError(res.status, data.error ?? 'Request failed');
    if (opts.cache) await cachePut(url, data);
    return { data: data as T, stale: false, at: Date.now() };
  } catch (e) {
    if (!isNetworkFailure(e)) throw e;
    const hit = await cacheGet<T>(url);
    if (!hit) throw new ApiError(0, 'Offline and no saved copy of this screen is available');
    return { data: hit.data, stale: true, at: hit.at };
  }
}
