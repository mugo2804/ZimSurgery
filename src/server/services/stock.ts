import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db';
import { stockItems } from '../db/schema';

export async function listStockItems(activeOnly = true) {
  const d = await db();
  return d.select().from(stockItems).where(activeOnly ? eq(stockItems.active, true) : undefined).orderBy(asc(stockItems.name));
}
