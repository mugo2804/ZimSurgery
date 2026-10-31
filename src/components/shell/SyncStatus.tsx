'use client';
import { useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { offlineDb } from '@/client/offline/db';
import { flushOutbox, onSyncChange, getLastSync } from '@/client/offline/outbox';
import { fmtTime } from '@/lib/time';

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); };
}

// Connectivity + outbox indicator (PLAN Phase 6.4)
export function SyncStatus() {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const lastSync = useSyncExternalStore(onSyncChange, getLastSync, () => null);
  const pending = useLiveQuery(() => offlineDb()?.outbox.where('status').equals('pending').count() ?? 0, [], 0);
  const conflicts = useLiveQuery(() => offlineDb()?.outbox.where('status').equals('conflict').count() ?? 0, [], 0);

  return (
    <div className="flex items-center gap-2 text-xs">
      {online ? (
        <span className="badge badge-green"><Wifi size={13} aria-hidden /> Online</span>
      ) : (
        <span className="badge badge-red"><WifiOff size={13} aria-hidden /> Offline — changes will sync later</span>
      )}
      {pending > 0 && (
        <button className="badge badge-amber" onClick={() => flushOutbox()} title="Send queued changes now">
          <RefreshCw size={13} aria-hidden /> {pending} queued
        </button>
      )}
      {conflicts > 0 && (
        <a href="/account#sync" className="badge badge-red"><AlertTriangle size={13} aria-hidden /> {conflicts} need attention</a>
      )}
      {lastSync && <span className="hidden text-muted md:inline">Synced {fmtTime(new Date(lastSync))}</span>}
    </div>
  );
}
