import 'server-only';
import { lt } from 'drizzle-orm';
import { db } from './db';
import { idempotencyKeys } from './db/schema';

// Background jobs (docs/ARCHITECTURE.md §7). Each is also callable via POST /api/cron/{job}.
export const JOBS: Record<string, () => Promise<unknown>> = {
  'cleanup-idempotency': async () => {
    const cutoff = new Date(Date.now() - 7 * 86_400_000);
    await (await db()).delete(idempotencyKeys).where(lt(idempotencyKeys.createdAt, cutoff));
    return { ok: true };
  },
};

const INTERVAL_MS = 15 * 60_000;
const g = globalThis as unknown as { __zimmedScheduler?: NodeJS.Timeout };

export async function runAllJobs() {
  for (const [name, job] of Object.entries(JOBS)) {
    try {
      await job();
    } catch (err) {
      console.error(`[scheduler] ${name} failed:`, err instanceof Error ? err.message : err);
    }
  }
}

export function startScheduler() {
  if (g.__zimmedScheduler) return;
  g.__zimmedScheduler = setInterval(runAllJobs, INTERVAL_MS);
  setTimeout(runAllJobs, 30_000);
}
