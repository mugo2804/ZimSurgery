'use client';
import Dexie, { type EntityTable } from 'dexie';

// Browser-side offline store (docs/ARCHITECTURE.md §4). Holds only today's working set
// and queued writes — never consultation notes — and is wiped on logout (SECURITY §5).

export type CacheEntry = { key: string; data: unknown; at: number };

export type OutboxEntry = {
  seq?: number;
  idemKey: string;
  method: 'POST' | 'PUT' | 'PATCH';
  url: string;
  body: unknown;
  label: string;
  createdAt: number;
  status: 'pending' | 'conflict';
  attempts: number;
  error?: string;
};

class OfflineDb extends Dexie {
  cache!: EntityTable<CacheEntry, 'key'>;
  outbox!: EntityTable<OutboxEntry, 'seq'>;
  constructor() {
    super('zimmed-offline');
    this.version(1).stores({ cache: 'key, at', outbox: '++seq, idemKey, status, createdAt' });
  }
}

let instance: OfflineDb | null = null;
export function offlineDb(): OfflineDb | null {
  if (typeof indexedDB === 'undefined') return null;
  return (instance ??= new OfflineDb());
}

export async function clearOfflineData() {
  const d = offlineDb();
  if (!d) return;
  await Promise.all([d.cache.clear(), d.outbox.clear()]);
}

export async function cachePut(key: string, data: unknown) {
  await offlineDb()?.cache.put({ key, data, at: Date.now() });
}

export async function cacheGet<T>(key: string): Promise<{ data: T; at: number } | null> {
  const row = await offlineDb()?.cache.get(key);
  return row ? { data: row.data as T, at: row.at } : null;
}
