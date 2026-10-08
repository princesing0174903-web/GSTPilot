// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Zoho Books Token Encryption
//
// AES-256-GCM encryption for OAuth tokens (access + refresh) stored in the
// `ZohoBooksToken` Prisma table. The encryption key is derived from
// ZOHO_CLIENT_SECRET via a double-HMAC-SHA256 construct with a fixed salt, so
// no separate encryption env var is required — mirroring the Google Workspace
// integration pattern exactly.
//
// Output format: a single base64 string containing `iv || ciphertext || authTag`
// (12 + N + 16 bytes), base64-encoded.
//
// SERVER-ONLY. Never import from a client component.
// ═══════════════════════════════════════════════════════════════════════════════

import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12; // GCM standard IV length
const AUTH_TAG_LEN = 16;
const SALT = 'gstpilot::zoho-books::v1';

/**
 * Derive a 32-byte AES-256 key from `ZOHO_CLIENT_SECRET` using a double-HMAC
 * construct (HKDF-like). The secret is high-entropy and the salt is fixed, so
 * this is sufficient for AES-256 key derivation without a KDF library.
 */
function getKey(): Buffer {
  const secret = process.env.ZOHO_CLIENT_SECRET;
  if (!secret) {
    throw new Error(
      'ZOHO_CLIENT_SECRET is not set. Cannot encrypt Zoho Books tokens.',
    );
  }
  const k1 = createHmac('sha256', secret).update(SALT).digest();
  const k2 = createHmac('sha256', k1).update(SALT).digest();
  return Buffer.concat([k1, k2]).subarray(0, 32);
}

/**
 * Encrypt a plaintext string. Returns a base64 string containing
 * `iv || ciphertext || authTag` (all concatenated, then base64-encoded).
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString('base64');
}

/**
 * Decrypt a value produced by `encrypt()`. Throws on tamper / wrong key.
 */
export function decrypt(payload: string): string {
  if (!payload) return '';
  const key = getKey();
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_LEN + AUTH_TAG_LEN) {
    throw new Error('Encrypted payload too short.');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - AUTH_TAG_LEN);
  const enc = buf.subarray(IV_LEN, buf.length - AUTH_TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}

/**
 * Best-effort decrypt — returns null on any failure (never throws). Use this
 * in read paths where a corrupt token shouldn't crash the request.
 */
export function safeDecrypt(payload: string): string | null {
  try {
    return decrypt(payload);
  } catch {
    return null;
  }
}
