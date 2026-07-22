// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Setu SDK — Webhook Verification + Parsing
// ═══════════════════════════════════════════════════════════════════════════════
//
// Setu posts three event types to your webhook URL:
//   - CONSENT_STATUS_UPDATE — consent reached ACTIVE / REJECTED / etc.
//   - SESSION_STATUS_UPDATE — data session reached COMPLETED / FAILED / etc.
//   - FI_DATA_READY         — auto-fetch flow; contains decrypted FI data inline.
//
// Signature: Setu-wide pattern is HMAC-SHA256(rawBodyString, webhookSecret),
// base64-encoded, sent in the `x-setu-signature` header. We verify with
// `crypto.timingSafeEqual` to prevent timing attacks.
//
// If `SETU_WEBHOOK_SECRET` is not configured, we still parse the payload but
// log a clear warning — this is insecure for production.
// ═══════════════════════════════════════════════════════════════════════════════

import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  SetuLinkedAccount,
  SetuWebhookConsentData,
  SetuWebhookEvent,
  SetuWebhookEventType,
  SetuWebhookSessionData,
} from './types';
import { setuLogger } from './utils';

const VALID_TYPES: ReadonlySet<SetuWebhookEventType> = new Set<SetuWebhookEventType>([
  'CONSENT_STATUS_UPDATE',
  'SESSION_STATUS_UPDATE',
  'FI_DATA_READY',
]);

/**
 * Verify a Setu webhook signature. Returns true if the signature matches.
 *
 * Uses HMAC-SHA256 with the raw body string + base64 encoding, then
 * `timingSafeEqual` to prevent timing-based signature forgery.
 *
 * Returns false (does NOT throw) if verification fails — the caller decides
 * whether to drop the request.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  if (!rawBody || !signature || !secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  try {
    const a = Buffer.from(signature, 'base64');
    const b = Buffer.from(expected, 'base64');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Parse + verify a Setu webhook event.
 *
 * @param rawBody The raw request body string (NOT parsed JSON — needed for signature verification).
 * @param signatureHeader The value of the `x-setu-signature` header (or null if absent).
 * @param secret The configured webhook secret. If empty, the event is still
 *   parsed but a warning is logged (insecure).
 * @returns The parsed event, or `null` if verification failed or the payload
 *   was not a valid Setu event.
 */
export function parseWebhookEvent(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): SetuWebhookEvent | null {
  // Verify signature first (if secret configured).
  if (secret) {
    if (!signatureHeader) {
      setuLogger.error('Webhook rejected — signature header missing', {});
      return null;
    }
    if (!verifyWebhookSignature(rawBody, signatureHeader, secret)) {
      setuLogger.error('Webhook rejected — signature verification failed', {});
      return null;
    }
  } else {
    setuLogger.warn('Webhook parsed WITHOUT signature verification — SETU_WEBHOOK_SECRET not set', {});
  }

  // Parse JSON.
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch (err) {
    setuLogger.error('Webhook body is not valid JSON', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  if (!parsed || typeof parsed !== 'object') {
    setuLogger.error('Webhook body is not an object', {});
    return null;
  }

  const evt = parsed as Partial<SetuWebhookEvent>;
  if (!evt.type || !VALID_TYPES.has(evt.type)) {
    setuLogger.error('Webhook rejected — unknown event type', { type: evt.type });
    return null;
  }

  setuLogger.info('Webhook parsed', { type: evt.type, consentId: evt.consentId });
  return evt as SetuWebhookEvent;
}

/**
 * True if this webhook event signals consent approval (status === 'ACTIVE').
 * Only meaningful for `CONSENT_STATUS_UPDATE` events.
 */
export function isConsentApproved(event: SetuWebhookEvent): boolean {
  if (event.type !== 'CONSENT_STATUS_UPDATE') return false;
  const data = event.data as SetuWebhookConsentData;
  return data?.status === 'ACTIVE';
}

/**
 * True if this webhook event signals a data session has completed (so we can
 * fetch the FI data). Only meaningful for `SESSION_STATUS_UPDATE` events.
 */
export function isSessionCompleted(event: SetuWebhookEvent): boolean {
  if (event.type !== 'SESSION_STATUS_UPDATE') return false;
  const data = event.data as SetuWebhookSessionData;
  return data?.status === 'COMPLETED';
}

/**
 * Extract linked accounts from a CONSENT_STATUS_UPDATE webhook payload.
 * Returns an empty array if the consent has no accounts yet (e.g. PENDING).
 */
export function extractLinkedAccountsFromWebhook(event: SetuWebhookEvent): SetuLinkedAccount[] {
  if (event.type !== 'CONSENT_STATUS_UPDATE') return [];
  const data = event.data as SetuWebhookConsentData;
  return data?.detail?.accounts ?? [];
}
