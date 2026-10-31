import { beforeAll } from 'vitest';
import { migrateDb } from '@/server/db';

beforeAll(async () => {
  await migrateDb();
});
