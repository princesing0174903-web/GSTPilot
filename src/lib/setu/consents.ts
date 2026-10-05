// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Setu SDK — Consent Helpers (creation, polling, account extraction)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Thin wrappers over `SetuClient` for the consent lifecycle. The polling
// helper (`waitForConsentApproval`) is the main convenience — it polls Setu
// every few seconds until the consent reaches a terminal state, with a
// sensible default timeout.
// ═══════════════════════════════════════════════════════════════════════════════

import type { SetuConsent, SetuLinkedAccount } from './types';
import { SetuApiError } from './types';
import type { SetuClient } from './client';
import { setuLogger, sleep } from './utils';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Build a consent request covering the last `monthsBack` months of transaction
 * history, valid for `consentMonths` months (default 12 — the Setu maximum).
 *
 * @param client SetuClient instance
 * @param opts.vua Mobile number or `mobile@aa-handle` (e.g. "9999999999")
 * @param opts.monthsBack How many months of historical transactions to request
 * @param opts.consentMonths Consent validity window in months (default 12)
 */
export async function createConsentForAccounts(
  client: SetuClient,
  opts: { vua: string; monthsBack: number; consentMonths?: number },
): Promise<SetuConsent> {
  const now = new Date();
  const from = new Date(now.getTime() - opts.monthsBack * 30 * DAY_MS);
  const consentMonths = opts.consentMonths ?? 12;

  return client.createConsent({
    vua: opts.vua,
    consentDuration: { unit: 'MONTH', value: String(consentMonths) },
    dataRange: { from: from.toISOString(), to: now.toISOString() },
  });
}

/**
 * Poll `GET /v2/consents/:id` until the consent reaches a terminal state
 * (ACTIVE / REJECTED / REVOKED / EXPIRED) or the timeout elapses.
 *
 * @returns The final consent object (status will be terminal or the last polled state).
 * @throws SetuApiError if the timeout elapses before a terminal state.
 */
export async function waitForConsentApproval(
  client: SetuClient,
  consentId: string,
  opts: { timeoutMs?: number; pollIntervalMs?: number } = {},
): Promise<SetuConsent> {
  const timeoutMs = opts.timeoutMs ?? 5 * 60 * 1000; // 5 min default
  const pollIntervalMs = opts.pollIntervalMs ?? 3000; // 3s default
  const deadline = Date.now() + timeoutMs;

  let last: SetuConsent | null = null;
  while (Date.now() < deadline) {
    const consent = await client.getConsent(consentId);
    last = consent;
    setuLogger.debug('Consent poll', { consentId, status: consent.status });
    if (
      consent.status === 'ACTIVE' ||
      consent.status === 'REJECTED' ||
      consent.status === 'REVOKED' ||
      consent.status === 'EXPIRED'
    ) {
      return consent;
    }
    await sleep(pollIntervalMs);
  }

  throw new SetuApiError({
    message: `Consent ${consentId} did not reach a terminal state within ${timeoutMs}ms (last status: ${last?.status ?? 'unknown'})`,
    status: 0,
    code: 'consent_timeout',
    isRetryable: false,
  });
}

/**
 * Extract linked accounts from a consent's `detail.accounts[]` block. Returns
 * an empty array if the consent hasn't been approved yet (no detail.accounts).
 */
export function extractLinkedAccounts(consent: SetuConsent): SetuLinkedAccount[] {
  return consent.detail?.accounts ?? [];
}
