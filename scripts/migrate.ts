import './load-env';
import { handle, migrateDb } from '../src/server/db';

await migrateDb();
await (await handle()).close();
console.log('✔ Database migrated');
