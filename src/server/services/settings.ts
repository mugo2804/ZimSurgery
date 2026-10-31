import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { exchangeRates, settings } from '../db/schema';
import { localDay } from '@/lib/time';

export type PracticeSettings = {
  practice_name: string;
  practice_address: string;
  practice_phone: string;
  practice_email: string;
  ahfoz_practice_no: string;
  letterhead_note: string;
  reminder_hours_before: string;
};

export const SETTING_KEYS: (keyof PracticeSettings)[] = [
  'practice_name', 'practice_address', 'practice_phone', 'practice_email', 'ahfoz_practice_no', 'letterhead_note', 'reminder_hours_before',
];

export async function getSettings(): Promise<PracticeSettings> {
  const rows = await (await db()).select().from(settings);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value ?? '']));
  return Object.fromEntries(SETTING_KEYS.map((k) => [k, map[k] ?? ''])) as PracticeSettings;
}

export async function saveSettings(values: Partial<PracticeSettings>) {
  const d = await db();
  for (const [key, value] of Object.entries(values)) {
    if (!SETTING_KEYS.includes(key as keyof PracticeSettings)) continue;
    await d.insert(settings).values({ key, value: value ?? '' }).onConflictDoUpdate({ target: settings.key, set: { value: value ?? '' } });
  }
}

export async function currentRate() {
  const [r] = await (await db()).select().from(exchangeRates).orderBy(desc(exchangeRates.effectiveAt)).limit(1);
  if (!r) return null;
  return { id: r.id, zigPerUsd: Number(r.zigPerUsd), source: r.source, effectiveAt: r.effectiveAt, isToday: localDay(r.effectiveAt) === localDay() };
}

export async function getSetting(key: keyof PracticeSettings) {
  const [r] = await (await db()).select().from(settings).where(eq(settings.key, key));
  return r?.value ?? '';
}
