import { describe, expect, it } from 'vitest';
import { decrypt, encrypt, isEncrypted } from '@/server/crypto';

describe('field encryption', () => {
  it('round-trips text and uses the newest key', () => {
    const c = encrypt('Chest pain radiating to left arm')!;
    expect(c.startsWith('v2:')).toBe(true);
    expect(isEncrypted(c)).toBe(true);
    expect(c).not.toContain('Chest');
    expect(decrypt(c)).toBe('Chest pain radiating to left arm');
  });

  it('uses a fresh IV per value', () => {
    expect(encrypt('same')).not.toBe(encrypt('same'));
  });

  it('treats empty as null', () => {
    expect(encrypt('')).toBeNull();
    expect(encrypt(null)).toBeNull();
    expect(decrypt(null)).toBe('');
  });

  it('rejects tampered ciphertext', () => {
    const [v, iv, tag, ct] = encrypt('hello world')!.split(':');
    const flipped = Buffer.from(ct, 'base64');
    flipped[0] ^= 1;
    expect(() => decrypt([v, iv, tag, flipped.toString('base64')].join(':'))).toThrow();
  });

  it('rejects unknown key versions', () => {
    expect(() => decrypt('v9:a:b:c')).toThrow(/key version/);
  });
});
