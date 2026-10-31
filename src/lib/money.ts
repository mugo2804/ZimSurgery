// Money helpers (docs/ARCHITECTURE.md §6). Integer cents everywhere; rounding happens once, at conversion.

export type Line = { qty: number; unitCents: number; aidUnitCents: number };

// Medical aid split: the aid pays its tariff (capped at the practice price), the patient pays the shortfall.
export function priceLines<T extends Line>(lines: T[], payer: 'cash' | 'medical_aid') {
  let total = 0;
  let aid = 0;
  const priced = lines.map((l) => {
    const totalCents = l.qty * l.unitCents;
    const aidTotalCents = payer === 'medical_aid' ? l.qty * Math.min(l.aidUnitCents, l.unitCents) : 0;
    total += totalCents;
    aid += aidTotalCents;
    return { ...l, totalCents, aidTotalCents };
  });
  return { lines: priced, totalCents: total, aidCents: aid, patientCents: total - aid };
}

const roundHalfAway = (n: number) => Math.sign(n) * Math.round(Math.abs(n));

// rate = ZiG per 1 USD
export const zigToUsdCents = (zigCents: number, rate: number) => roundHalfAway(zigCents / rate);
export const usdToZigCents = (usdCents: number, rate: number) => roundHalfAway(usdCents * rate);

export const toCents = (amount: number | string) => roundHalfAway(Number(amount) * 100);

export const formatUSD = (cents: number) =>
  `US$${(cents / 100).toLocaleString('en-ZW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const formatZiG = (cents: number) =>
  `ZiG ${(cents / 100).toLocaleString('en-ZW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const formatMoney = (cents: number, currency: 'USD' | 'ZiG') => (currency === 'USD' ? formatUSD(cents) : formatZiG(cents));

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  usd_cash: 'USD Cash',
  zig_cash: 'ZiG Cash',
  swipe: 'Swipe (ZimSwitch)',
  ecocash: 'EcoCash',
  innbucks: 'InnBucks',
  bank_transfer: 'Bank transfer',
  medical_aid: 'Medical aid',
};

// Currency each tender method is collected in. Swipe/EcoCash/InnBucks/bank can be either.
export const METHOD_CURRENCIES: Record<string, ('USD' | 'ZiG')[]> = {
  usd_cash: ['USD'],
  zig_cash: ['ZiG'],
  swipe: ['USD', 'ZiG'],
  ecocash: ['USD', 'ZiG'],
  innbucks: ['USD', 'ZiG'],
  bank_transfer: ['USD', 'ZiG'],
  medical_aid: ['USD'],
};
