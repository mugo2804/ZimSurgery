import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import * as schema from './schema';

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

type Handle = { db: DB; migrate: () => Promise<void>; close: () => Promise<void> };

const MIGRATIONS = path.join(process.cwd(), 'drizzle');

// DATABASE_URL unset → PGlite file at .data/pglite (dev, zero install)
// DATABASE_URL=pglite://memory → in-memory PGlite (tests)
// DATABASE_URL=postgres://… → PostgreSQL via postgres.js (production)
async function open(): Promise<Handle> {
  const url = process.env.DATABASE_URL ?? '';
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    const { default: postgres } = await import('postgres');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { migrate } = await import('drizzle-orm/postgres-js/migrator');
    const client = postgres(url, { max: Number(process.env.DB_POOL_MAX ?? 10) });
    const db = drizzle({ client, schema, casing: 'snake_case' });
    return { db: db as unknown as DB, migrate: () => migrate(db, { migrationsFolder: MIGRATIONS }), close: () => client.end() };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  let dataDir: string | undefined;
  if (url !== 'pglite://memory') {
    dataDir = process.env.PGLITE_DIR ?? path.join(process.cwd(), '.data', 'pglite');
    mkdirSync(dataDir, { recursive: true });
  }
  const client = new PGlite(dataDir);
  const db = drizzle({ client, schema, casing: 'snake_case' });
  return { db: db as unknown as DB, migrate: () => migrate(db, { migrationsFolder: MIGRATIONS }), close: () => client.close() };
}

// One connection per process, surviving Next.js dev hot reloads
const g = globalThis as unknown as { __zimmedDb?: Promise<Handle> };
export const handle = () => (g.__zimmedDb ??= open());

let rootDb: DB | undefined;
export async function getRootDb(): Promise<DB> {
  return (rootDb ??= (await handle()).db);
}

export async function migrateDb() {
  await (await handle()).migrate();
}

// The request pipeline runs each mutation in a transaction and stores it here,
// so services can call db() without threading a tx parameter through every call.
const txStore = new AsyncLocalStorage<{ tx: DB; afterCommit: (() => void)[] }>();

export async function db(): Promise<DB> {
  return txStore.getStore()?.tx ?? getRootDb();
}

export async function withTx<T>(fn: () => Promise<T>): Promise<T> {
  if (txStore.getStore()) return fn();
  const root = await getRootDb();
  const afterCommit: (() => void)[] = [];
  const result = await root.transaction((tx) => txStore.run({ tx: tx as unknown as DB, afterCommit }, fn));
  for (const cb of afterCommit) cb();
  return result;
}

// Run side effects (live-update events, outbound messages) only once the data is committed
export function afterCommit(cb: () => void) {
  const store = txStore.getStore();
  if (store) store.afterCommit.push(cb);
  else cb();
}

// Human-readable document numbers: ZMP-000001, RX-000001, …
export async function nextNumber(name: string, prefix: string, width = 6): Promise<string> {
  const d = await db();
  const rows = await d.execute<{ value: number }>(sql`
    INSERT INTO sequences (name, value) VALUES (${name}, 1)
    ON CONFLICT (name) DO UPDATE SET value = sequences.value + 1
    RETURNING value`);
  const value = (rows as unknown as { rows?: { value: number }[] }).rows?.[0]?.value ?? (rows as unknown as { value: number }[])[0].value;
  return `${prefix}${String(value).padStart(width, '0')}`;
}

export { schema };
