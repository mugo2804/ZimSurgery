import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Field-level AES-256-GCM. Stored format: <keyVersion>:<iv b64>:<tag b64>:<ciphertext b64>
// FIELD_ENCRYPTION_KEYS="v1:<base64 32 bytes>,v2:<…>" — the last key encrypts, all keys decrypt.

type KeyRing = { current: string; keys: Map<string, Buffer> };
let ring: KeyRing | undefined;

function keyRing(): KeyRing {
  if (ring) return ring;
  const raw = process.env.FIELD_ENCRYPTION_KEYS;
  if (!raw) throw new Error('FIELD_ENCRYPTION_KEYS is not set');
  const keys = new Map<string, Buffer>();
  let current = '';
  for (const entry of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [version, b64] = entry.split(':');
    const key = Buffer.from(b64 ?? '', 'base64');
    if (!/^v\d+$/.test(version) || key.length !== 32) throw new Error(`Invalid encryption key entry "${version}"`);
    keys.set(version, key);
    current = version;
  }
  ring = { current, keys };
  return ring;
}

export function encrypt(plain: string | null | undefined): string | null {
  if (plain == null || plain === '') return null;
  const { current, keys } = keyRing();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keys.get(current)!, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [current, iv.toString('base64'), cipher.getAuthTag().toString('base64'), ct.toString('base64')].join(':');
}

export function decrypt(stored: string | null | undefined): string {
  if (!stored) return '';
  const [version, iv, tag, ct] = stored.split(':');
  const key = keyRing().keys.get(version);
  if (!key || !iv || !tag || ct === undefined) throw new Error('Unreadable encrypted field (unknown key version or corrupt value)');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString('utf8');
}

export const isEncrypted = (v: unknown) => typeof v === 'string' && /^v\d+:[^:]+:[^:]+:/.test(v);
