// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Production Pipeline™ — API Key Encryption (SERVER-ONLY)
//
// AES-256-GCM authenticated encryption for AI provider API keys (OpenAI,
// Anthropic, etc.). Same security contract as the GSTN crypto module.
//
// SECURITY CONTRACT:
//   • This file uses Node's `crypto` module — it MUST NEVER be imported by
//     client-side code. API routes are the only legitimate consumers.
//   • The master key comes from `AI_ENCRYPTION_KEY` env var (32-byte hex/base64).
//   • In dev a deterministic fallback key is used so the app runs without
//     configuration; in production the env var MUST be set.
//
// Encryption format: `v1:<iv-base64>:<ciphertext-base64>:<tag-base64>`
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const VERSION = 'v1';

let cachedKey: Buffer | null = null;

function getMasterKey(): Buffer {
  if (cachedKey) return cachedKey;

  const envKey = process.env.AI_ENCRYPTION_KEY;
  if (envKey) {
    let key: Buffer | null = null;
    if (/^[0-9a-fA-F]{64}$/.test(envKey)) {
      key = Buffer.from(envKey, 'hex');
    } else {
      const decoded = Buffer.from(envKey, 'base64');
      if (decoded.length === 32) key = decoded;
    }
    if (!key || key.length !== 32) {
      throw new Error('AI_ENCRYPTION_KEY must be 32 bytes (64 hex chars or 44 base64 chars).');
    }
    cachedKey = key;
    return key;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('AI_ENCRYPTION_KEY environment variable is required in production.');
  }
  console.warn(
    '[ai-pipeline/crypto] WARNING: Using dev fallback encryption key. ' +
      'Set AI_ENCRYPTION_KEY (32-byte hex or base64) for production.',
  );
  cachedKey = crypto.createHash('sha256').update('gstpilot-ai-dev-encryption-key-v1').digest();
  return cachedKey;
}

export function encryptString(plaintext: string): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), ciphertext.toString('base64'), tag.toString('base64')].join(':');
}

export function decryptString(encrypted: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Unsupported encrypted format. Expected v1:iv:ct:tag.');
  }
  const [, ivB64, ctB64, tagB64] = parts;
  const key = getMasterKey();
  const iv = Buffer.from(ivB64, 'base64');
  const ciphertext = Buffer.from(ctB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  if (iv.length !== IV_LENGTH) throw new Error('Invalid IV length.');
  if (tag.length !== TAG_LENGTH) throw new Error('Invalid auth tag length.');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

export function encryptApiKey(key: string): string {
  return encryptString(key);
}

export function decryptApiKey(encrypted: string): string {
  return decryptString(encrypted);
}

export function generateKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function verifyCrypto(): boolean {
  try {
    const sample = 'sk-test-12345';
    const encrypted = encryptString(sample);
    return decryptString(encrypted) === sample;
  } catch {
    return false;
  }
}
