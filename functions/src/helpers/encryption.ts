/**
 * AES-256-GCM encryption helpers.
 *
 * Mirrors the Next.js client-side crypto pattern (see src/lib/billing-provider/crypto.ts)
 * so server-encrypted values are interoperable with client decryption and vice-versa.
 *
 * Output format (base64): `<12-byte-iv> || <ciphertext> || <16-byte-auth-tag>`
 *
 * The key must be exactly 32 bytes (256 bits), typically loaded from the
 * `BILLING_ENCRYPTION_KEY` Cloud Function secret (base64-encoded).
 */
import crypto from 'crypto';
import type { EncryptedField } from '../types';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Encode a 32-byte key from a base64 or hex string. Throws if invalid.
 */
export function loadKey(encoded: string): Buffer {
  let buf: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(encoded)) {
    buf = Buffer.from(encoded, 'hex');
  } else {
    buf = Buffer.from(encoded, 'base64');
  }
  if (buf.length !== 32) {
    throw new Error(`Encryption key must decode to 32 bytes, got ${buf.length}`);
  }
  return buf;
}

/**
 * Encrypt a UTF-8 plaintext string under the given 32-byte key.
 * Returns an EncryptedField with base64-encoded payload.
 */
export function encrypt(plaintext: string, key: Buffer): EncryptedField {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, ct, tag]).toString('base64');
  return { v: payload, alg: 'aes-256-gcm' };
}

/**
 * Decrypt an EncryptedField produced by `encrypt()` (or the client's mirror).
 * Throws on auth-tag failure (tampered ciphertext / wrong key).
 */
export function decrypt(field: EncryptedField, key: Buffer): string {
  if (field.alg !== ALGO) {
    throw new Error(`Unsupported encryption algorithm: ${field.alg}`);
  }
  const buf = Buffer.from(field.v, 'base64');
  if (buf.length < IV_BYTES + TAG_BYTES) {
    throw new Error('Ciphertext too short');
  }
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(buf.length - TAG_BYTES);
  const ct = buf.subarray(IV_BYTES, buf.length - TAG_BYTES);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}
