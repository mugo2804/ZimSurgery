// Next.js server start-up hook: apply migrations, then start the in-process scheduler.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { migrateDb } = await import('./server/db');
  if (process.env.MIGRATE_ON_START !== 'false') await migrateDb();
  if (process.env.SCHEDULER === 'on') {
    const { startScheduler } = await import('./server/scheduler');
    startScheduler();
  }
}
