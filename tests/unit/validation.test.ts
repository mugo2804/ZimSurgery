import { describe, expect, it } from 'vitest';
import { normalizeZimPhone, normalizeNationalId, bmi, ageFrom } from '@/lib/validation';

describe('Zimbabwe identifiers', () => {
  it('normalises mobile numbers', () => {
    expect(normalizeZimPhone('0772 123 456')).toBe('263772123456');
    expect(normalizeZimPhone('+263 77 212 3456')).toBe('263772123456');
    expect(normalizeZimPhone('772123456')).toBe('263772123456');
    expect(normalizeZimPhone('00263712987654')).toBe('263712987654');
    expect(normalizeZimPhone('0712')).toBeNull();
    expect(normalizeZimPhone('0792123456')).toBeNull();
  });

  it('normalises national IDs', () => {
    expect(normalizeNationalId('63-123456F42')).toBe('63-123456 F 42');
    expect(normalizeNationalId('08 7654321 k 18')).toBe('08-7654321 K 18');
    expect(normalizeNationalId('12345')).toBeNull();
  });

  it('computes BMI and age', () => {
    expect(bmi(70, 175)).toBe(22.9);
    expect(bmi(null, 175)).toBeNull();
    expect(ageFrom('2000-06-15', new Date('2026-06-14'))).toBe(25);
    expect(ageFrom('2000-06-15', new Date('2026-06-15'))).toBe(26);
  });
});
