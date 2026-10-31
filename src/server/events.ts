import 'server-only';
import { EventEmitter } from 'node:events';
import { afterCommit } from './db';

// In-process event bus for live screens (docs/ARCHITECTURE.md §3).
// Payloads carry IDs only, never patient data — clients refetch over the authorised API.
export type AppEvent = { type: 'queue.changed' | 'appointments.changed'; id?: string };

const g = globalThis as unknown as { __zimmedBus?: EventEmitter };
export const bus = (g.__zimmedBus ??= new EventEmitter().setMaxListeners(200));

export const emit = (ev: AppEvent) => afterCommit(() => bus.emit('event', ev));
