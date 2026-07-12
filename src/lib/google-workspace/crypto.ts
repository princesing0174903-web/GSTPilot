// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Google Workspace Token Encryption
//
// AES-256-GCM encryption for OAuth tokens (access + refresh) stored in the
// `GoogleWorkspaceToken` Prisma table. The encryption key is derived from
// GOOGLE_CLIENT_SECRET via HKDF-SHA256 so no separate encryption env var is
// required (per the integration spec: "use these env vars only").
//
// SERVER-ONLY. Never import from a client component.
// ═══════════════════════════════════════════════════════════════════════════════

import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12; // GCM standard IV length
const SALT = 'gstpilot::google-workspace::v1';

function getKey(): Buffer {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) {
    throw new Error('GOOGLE_CLIENT_SECRET is not set. Cannot encrypt Google tokens.');
  }
  // Derive a 32-byte key via HKDF-like construct (HMAC-based). Sufficient for
  // a fixed-length, non-secret salt + a high-entropy secret input.
  const k1 = createHmac('sha256', secret).update(SALT).digest();
  const k2 = createHmac('sha256', k1).update(SALT).digest();
  return Buffer.concat([k1, k2]).subarray(0, 32);
}

/**
 * Encrypt a plaintext string. Returns a base64 string containing
 * `iv || ciphertext || authTag` (all concatenated, then base64-encoded).
 */
export function encrypt(plaintext: string): string {
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
  const key = getKey();
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_LEN + 16) {
    throw new Error('Encrypted payload too short.');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - 16);
  const enc = buf.subarray(IV_LEN, buf.length - 16);
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
