import { describe, expect, it } from 'vitest';
import { priceLines, toCents, usdToZigCents, zigToUsdCents, formatUSD, formatZiG } from '@/lib/money';

describe('medical aid split (FEATURES D1)', () => {
  it('cash patients pay the full practice price', () => {
    const r = priceLines([{ qty: 1, unitCents: 3000, aidUnitCents: 2500 }, { qty: 2, unitCents: 500, aidUnitCents: 400 }], 'cash');
    expect(r).toMatchObject({ totalCents: 4000, aidCents: 0, patientCents: 4000 });
  });

  it('aid pays its tariff, patient pays the shortfall, and parts sum to total', () => {
    const r = priceLines([{ qty: 1, unitCents: 3000, aidUnitCents: 2500 }, { qty: 3, unitCents: 500, aidUnitCents: 400 }], 'medical_aid');
    expect(r.totalCents).toBe(4500);
    expect(r.aidCents).toBe(3700);
    expect(r.patientCents).toBe(800);
    expect(r.aidCents + r.patientCents).toBe(r.totalCents);
  });

  it('caps the aid portion at the practice price', () => {
    const r = priceLines([{ qty: 1, unitCents: 2000, aidUnitCents: 2600 }], 'medical_aid');
    expect(r).toMatchObject({ aidCents: 2000, patientCents: 0 });
  });

  it('handles items the aid does not cover', () => {
    const r = priceLines([{ qty: 1, unitCents: 1000, aidUnitCents: 0 }], 'medical_aid');
    expect(r).toMatchObject({ aidCents: 0, patientCents: 1000 });
  });
});

describe('ZiG conversion (FEATURES D2)', () => {
  const rate = 26.75;
  it('converts both ways with half-away-from-zero rounding', () => {
    expect(usdToZigCents(3000, rate)).toBe(80250);
    expect(zigToUsdCents(80250, rate)).toBe(3000);
    expect(zigToUsdCents(100, rate)).toBe(4); // 3.738… → 4
    expect(zigToUsdCents(40, 26.75)).toBe(1); // 1.495… → 1
    expect(usdToZigCents(1, 26.755)).toBe(27);
  });

  it('parses decimal amounts to cents without float drift', () => {
    expect(toCents('19.99')).toBe(1999);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents('1234.565')).toBe(123457);
  });

  it('formats currencies', () => {
    expect(formatUSD(123456)).toBe('US$1,234.56');
    expect(formatZiG(80250)).toBe('ZiG 802.50');
  });
});
