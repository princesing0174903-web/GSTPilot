// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Google Workspace Token Crypto (server-only)
// ═══════════════════════════════════════════════════════════════════════════════
// AES-256-GCM encryption for Google OAuth tokens at rest.
//
// Key derivation (double-HMAC-SHA256):
//   root = GOOGLE_CLIENT_SECRET
//   h1   = HMAC-SHA256(key='gstpilot-google-v1', msg=root)
//   key  = HMAC-SHA256(key=h1, msg='aes-256-gcm-key')   ← 32 bytes (AES-256)
//
// Why double HMAC?
//   • Ensures a fixed-length 32-byte key even if the secret is short.
//   • Domain-separates the key from any other use of the secret.
//   • Same pattern used elsewhere in the codebase (Zoho Books, Banking, etc.).
//
// Ciphertext format: `<iv.b64>.<tag.b64>.<ct.b64>` — all three parts base64-encoded.
// ═══════════════════════════════════════════════════════════════════════════════

import 'server-only';
import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12; // 96-bit IV (recommended for GCM)
const KEY_LABEL = 'gstpilot-google-v1';
const KEY_USAGE = 'aes-256-gcm-key';

let cachedKey: Buffer | null = null;

/**
 * Derive the 32-byte AES key from GOOGLE_CLIENT_SECRET via double-HMAC.
 * Cached after first derivation — derivation is deterministic.
 */
function deriveKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) {
    throw new Error(
      'GOOGLE_CLIENT_SECRET is not set — cannot derive Google Workspace encryption key.'
    );
  }
  const h1 = crypto.createHmac('sha256', KEY_LABEL).update(secret).digest();
  const key = crypto.createHmac('sha256', h1).update(KEY_USAGE).digest();
  cachedKey = key;
  return key;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns `<iv>.<authTag>.<ciphertext>` (all base64).
 *
 * The auth tag guarantees integrity — tampered ciphertexts fail to decrypt.
 */
export function encrypt(plaintext: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
}

/**
 * Decrypt an AES-256-GCM payload produced by `encrypt()`.
 * Throws if the key is wrong, the payload is malformed, or the auth tag fails.
 */
export function decrypt(payload: string): string {
  const key = deriveKey();
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed Google Workspace ciphertext (expected 3 parts).');
  }
  const [ivB64, tagB64, encB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const enc = Buffer.from(encB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}

/**
 * Safe variant of `decrypt` — returns null instead of throwing.
 * Use this in code paths where a corrupt ciphertext shouldn't crash the request
 * (e.g. when loading a token that may have been encrypted with a rotated key).
 */
export function safeDecrypt(payload: string | null | undefined): string | null {
  if (!payload || typeof payload !== 'string') return null;
  try {
    return decrypt(payload);
  } catch {
    return null;
  }
}
