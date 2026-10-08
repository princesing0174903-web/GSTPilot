// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO ERP & Accounting Integrations™ — Credential Encryption (SERVER-ONLY)
//
// AES-256-GCM authenticated encryption for ERP access/refresh tokens + company
// credentials.
//
// SECURITY CONTRACT:
//   • This file uses Node's `crypto` module — it MUST NEVER be imported by
//     client-side code. API routes are the only legitimate consumers.
//   • The master key comes from the `ERP_ENCRYPTION_KEY` env var (32-byte
//     hex or base64). In dev a deterministic fallback key is used so the app
//     runs without configuration; in production the env var MUST be set.
//   • We never log or return decrypted sessions to the client. The client
//     only ever sees the `encryptedConnection` blob (which it cannot decrypt).
//
// Encryption format: `v1:<iv-base64>:<ciphertext-base64>:<tag-base64>`
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV is the GCM standard
const TAG_LENGTH = 16;
const VERSION = 'v1';

// Lazy-loaded master key — read once from env, cached for the process lifetime.
let cachedKey: Buffer | null = null;

/**
 * Resolve the master encryption key.
 *
 * Priority:
 *   1. `ERP_ENCRYPTION_KEY` env var (32 bytes hex or base64)
 *   2. Dev fallback — a deterministic key derived from the project name.
 *      This is INSECURE for production but lets the app boot without config.
 *      A loud warning is logged in dev.
 */
function getMasterKey(): Buffer {
  if (cachedKey) return cachedKey;

  const envKey = process.env.ERP_ENCRYPTION_KEY;
  if (envKey) {
    let key: Buffer | null = null;
    if (/^[0-9a-fA-F]{64}$/.test(envKey)) {
      key = Buffer.from(envKey, 'hex');
    } else {
      const decoded = Buffer.from(envKey, 'base64');
      if (decoded.length === 32) key = decoded;
    }
    if (!key || key.length !== 32) {
      throw new Error(
        'ERP_ENCRYPTION_KEY must be 32 bytes (64 hex chars or 44 base64 chars).',
      );
    }
    cachedKey = key;
    return key;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'ERP_ENCRYPTION_KEY environment variable is required in production.',
    );
  }
  console.warn(
    '[erp-provider/crypto] WARNING: Using dev fallback encryption key. ' +
      'Set ERP_ENCRYPTION_KEY (32-byte hex or base64) for production.',
  );
  // DIFFERENT seed from GSTN/banking/communication keys.
  cachedKey = crypto.createHash('sha256').update('gstpilot-erp-encryption-key-v1').digest();
  return cachedKey;
}

/** Encrypt a plaintext string using AES-256-GCM. */
export function encryptString(plaintext: string): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), ciphertext.toString('base64'), tag.toString('base64')].join(':');
}

/** Decrypt a `v1:<iv>:<ciphertext>:<tag>` blob back to plaintext. */
export function decryptString(encrypted: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Unsupported encrypted connection format. Expected v1:iv:ct:tag.');
  }
  const [, ivB64, ctB64, tagB64] = parts;
  const key = getMasterKey();
  const iv = Buffer.from(ivB64, 'base64');
  const ciphertext = Buffer.from(ctB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');

  if (iv.length !== IV_LENGTH) {
    throw new Error('Invalid IV length in encrypted connection.');
  }
  if (tag.length !== TAG_LENGTH) {
    throw new Error('Invalid auth tag length in encrypted connection.');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

/** Encrypt a JSON-serializable session object. */
export function encryptConnection(session: unknown): string {
  return encryptString(JSON.stringify(session));
}

/** Decrypt a connection blob and parse it back into the typed object. */
export function decryptConnection<T = unknown>(encrypted: string): T {
  return JSON.parse(decryptString(encrypted)) as T;
}

/** Verify the crypto module is correctly configured (used by health checks). */
export function verifyCrypto(): boolean {
  try {
    const sample = { test: 'value', num: 42, nested: { ok: true } };
    const encrypted = encryptConnection(sample);
    const decrypted = decryptConnection<typeof sample>(encrypted);
    return JSON.stringify(decrypted) === JSON.stringify(sample);
  } catch {
    return false;
  }
}
