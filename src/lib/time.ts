// Practice time zone: Africa/Harare (CAT, UTC+2, no daylight saving). Stored timestamps are UTC.
export const TZ = 'Africa/Harare';
const OFFSET = '+02:00';

// Local calendar date (YYYY-MM-DD) of an instant
export function localDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

// UTC instants bounding a local day range [from 00:00, to+1 00:00)
export function dayBounds(from: string, to: string = from): [Date, Date] {
  const start = new Date(`${from}T00:00:00${OFFSET}`);
  const end = new Date(new Date(`${to}T00:00:00${OFFSET}`).getTime() + 86_400_000);
  return [start, end];
}

export const localDateTime = (day: string, time: string) => new Date(`${day}T${time}:00${OFFSET}`);

export const fmtTime = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(d)) : '';

export const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d)) : '';

export const fmtDateTime = (d: Date | string | null | undefined) => (d ? `${fmtDate(d)} ${fmtTime(d)}` : '');

// Local hour (0-23) in Harare
export const localHour = (d: Date = new Date()) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(d));

export const minutesSince = (d: Date | string) => Math.floor((Date.now() - new Date(d).getTime()) / 60_000);

export function addMonths(d: Date, months: number) {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}
