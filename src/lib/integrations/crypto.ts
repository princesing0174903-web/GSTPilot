// ═══════════════════════════════════════════════════════════════════════════════
// crypto.ts — AES-256-GCM encryption for integration credentials
//
// Format of `credentialsEnc`:  `ivBase64:authTagBase64:ciphertextBase64`
//
// Key source: `process.env.INTEGRATION_ENCRYPTION_KEY` (32-byte hex string).
// In dev (NODE_ENV !== 'production'), if the env var is missing we fall back
// to a hardcoded dev key with a loud console.warn. In production we THROW —
// we never silently use a known key.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'
import type { DecryptedCredentials } from './types'

// 32 bytes = 256 bits. AES-256 requires exactly this length.
const KEY_BYTES = 32
const IV_BYTES = 12 // GCM standard nonce length

// Hardcoded dev-only fallback key. DO NOT use in production.
const DEV_KEY_HEX =
  '0000000000000000000000000000000000000000000000000000000000000001'

function resolveKeyHex(): string {
  const envKey = process.env.INTEGRATION_ENCRYPTION_KEY
  if (envKey && /^[0-9a-fA-F]{64}$/.test(envKey)) {
    return envKey
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'INTEGRATION_ENCRYPTION_KEY must be set to a 64-char hex string (32 bytes) in production.',
    )
  }

  // Dev-only fallback. Loud warning so nobody forgets.
  if (!envKey) {
    console.warn(
      '[integrations/crypto] INTEGRATION_ENCRYPTION_KEY is not set. ' +
        'Falling back to a hardcoded dev-only key. DO NOT use in production.',
    )
  } else {
    console.warn(
      '[integrations/crypto] INTEGRATION_ENCRYPTION_KEY is set but not a 64-char hex string. ' +
        'Falling back to a hardcoded dev-only key. DO NOT use in production.',
    )
  }
  return DEV_KEY_HEX
}

function keyBuffer(): Buffer {
  return Buffer.from(resolveKeyHex(), 'hex')
}

/**
 * Encrypt an arbitrary credentials object to a single string suitable for
 * storage in `Connection.credentialsEnc`.
 */
export function encryptCredentials(plain: object): string {
  const key = keyBuffer()
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `Encryption key must be ${KEY_BYTES} bytes (got ${key.length}).`,
    )
  }

  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const json = Buffer.from(JSON.stringify(plain), 'utf8')

  const ciphertext = Buffer.concat([cipher.update(json), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':')
}

/**
 * Reverse of `encryptCredentials`. Returns the decrypted credentials object.
 * Throws if the ciphertext is malformed or the auth tag does not verify
 * (tampered / wrong key).
 */
export function decryptCredentials(enc: string): DecryptedCredentials {
  const parts = enc.split(':')
  if (parts.length !== 3) {
    throw new Error('Malformed credentials blob (expected iv:authTag:ciphertext).')
  }
  const [ivB64, authTagB64, ciphertextB64] = parts as [string, string, string]

  const key = keyBuffer()
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const ciphertext = Buffer.from(ciphertextB64, 'base64')

  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  let plain: Buffer
  try {
    plain = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  } catch (err) {
    throw new Error(
      'Failed to decrypt credentials (auth tag mismatch or wrong key).',
    )
  }

  try {
    return JSON.parse(plain.toString('utf8')) as DecryptedCredentials
  } catch {
    throw new Error('Decrypted credentials are not valid JSON.')
  }
}

/**
 * Constant-time comparison helper — used by webhook signature verifiers.
 * Exported here so every adapter that needs it gets the same safe impl.
 */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}
