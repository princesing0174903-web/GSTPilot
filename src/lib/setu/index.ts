// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Setu SDK — Barrel Export
// ═══════════════════════════════════════════════════════════════════════════════
//
// Single import surface for the Setu SDK. Internal modules import from each
// other directly; external consumers (the SetuBankingProvider, API routes,
// tests) import from here.
//
//   import { getSetuClient, isSetuConfigured, SetuApiError } from '@/lib/setu';
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Types ────────────────────────────────────────────────────────────────────
export * from './types';

// ─── Utilities (config, logger, helpers) ──────────────────────────────────────
export {
  loadSetuConfig,
  isSetuConfigured,
  setuLogLevel,
  maskString,
  parseAmount,
  toISO,
  sleep,
  backoffMs,
  isRetryableStatus,
  setuLogger,
} from './utils';

// ─── OAuth2 token manager ─────────────────────────────────────────────────────
export { SetuAuth } from './auth';

// ─── HTTP client + singleton ──────────────────────────────────────────────────
export { SetuClient, getSetuClient } from './client';

// ─── Consent lifecycle helpers ────────────────────────────────────────────────
export {
  createConsentForAccounts,
  waitForConsentApproval,
  extractLinkedAccounts,
} from './consents';

// ─── Account mapping helpers ──────────────────────────────────────────────────
export {
  fetchAccountsFromSession,
  collectDeliveredAccounts,
  fipNameFromSession,
  normalizeMaskedAccount,
  mapAccountType,
  mapAccountStatus,
  mapSetuAccountToBanking,
} from './accounts';

// ─── Transaction mapping helpers ──────────────────────────────────────────────
export {
  fetchTransactionsFromSession,
  mapSetuTransactionToBanking,
} from './transactions';

// ─── Webhook verification + parsing ───────────────────────────────────────────
export {
  verifyWebhookSignature,
  parseWebhookEvent,
  isConsentApproved,
  isSessionCompleted,
  extractLinkedAccountsFromWebhook,
} from './webhooks';
