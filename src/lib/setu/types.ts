// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Setu SDK — API Types (mirrors verified Setu AA V2 spec)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Verified against docs.setu.co/data/account-aggregator/* (see worklog SETU-RESEARCH).
// These types describe the wire shapes Setu's AA gateway returns/accepts.
//
// Conventions:
//   - Setu returns amounts as STRING decimals ("33834.65"); keep them as strings
//     here and parse to numbers in the mapping layer (utils.parseAmount).
//   - Most response envelopes have a `traceId`; we keep it for diagnostics.
//   - Unknown/extra fields are typed as `unknown` to keep the contract strict
//     without lying about Setu's actual responses.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Config ───────────────────────────────────────────────────────────────────

/**
 * Setu SDK configuration. Loaded from environment via `loadSetuConfig()`.
 * All fields are required for the SDK to operate; optional tuning knobs have
 * sensible defaults baked into `loadSetuConfig()` itself.
 */
export interface SetuConfig {
  /** OAuth2 client id (from Setu Bridge product instance). */
  clientId: string;
  /** OAuth2 client secret. NEVER logged. */
  clientSecret: string;
  /** Product instance id (sent as `x-product-instance-id` header). */
  productInstanceId: string;
  /** AA gateway base URL (sandbox: https://fiu-sandbox.setu.co, prod: https://fiu.setu.co). */
  baseUrl: string;
  /** OAuth2 token endpoint (sandbox: https://uat.setu.co/api/v2/auth/token). */
  authUrl: string;
  /** HMAC-SHA256 webhook secret (used to verify incoming Setu webhook signatures). */
  webhookSecret?: string;
  /** Per-request HTTP timeout (ms). Default 15000. */
  timeoutMs?: number;
  /** Max retries on 429/5xx. Default 3. */
  maxRetries?: number;
  /** Log verbosity: 'error' | 'warn' | 'info' | 'debug'. Default 'info'. */
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
}

// ─── OAuth ────────────────────────────────────────────────────────────────────

/**
 * Setu OAuth2 token response. The gateway returns `{status, success, data:{token, expiresIn}}`.
 * `expiresIn` is in seconds (typically 1800 = 30 min).
 */
export interface SetuTokenResponse {
  status: number;
  success: boolean;
  data: {
    token: string;
    expiresIn: number;
  };
  error?: SetuError;
  traceId?: string;
}

// ─── Consents ─────────────────────────────────────────────────────────────────

export interface SetuConsentDuration {
  unit: 'MONTH' | 'DAY' | 'YEAR';
  value: string;
}

export interface SetuDateRange {
  from: string; // ISO 8601
  to: string; // ISO 8601
}

/** Body for `POST /v2/consents`. */
export interface SetuConsentRequest {
  /** VUA — mobile number or `mobile@aa-handle`. */
  vua: string;
  consentDuration: SetuConsentDuration;
  dataRange: SetuDateRange;
  context?: Array<{ key: string; value: string }>;
  additionalParams?: { tags?: string[] };
}

/**
 * The `detail` block on a consent — present after the user approves.
 * Contains the consent window + fiTypes + the linked account list.
 */
export interface SetuConsentDetail {
  consentStart?: string;
  consentExpiry?: string;
  fiTypes?: string[];
  fetchType?: string;
  purpose?: string;
  vua?: string;
  dataRange?: SetuDateRange;
  consentTypes?: string[];
  consentMode?: string;
  frequency?: { unit: string; value: string };
  dataLife?: { unit: string; value: string };
  /** Linked accounts — present once the consent is ACTIVE. */
  accounts?: SetuLinkedAccount[];
}

/** All consent lifecycle states observed from Setu. */
export type SetuConsentStatus =
  | 'INITIATED'
  | 'PENDING'
  | 'ACTIVE'
  | 'REJECTED'
  | 'REVOKED'
  | 'PAUSED'
  | 'EXPIRED';

/** Consent object returned by `POST /v2/consents` and `GET /v2/consents/:id`. */
export interface SetuConsent {
  id: string;
  /** Setu-hosted webview URL the user visits to approve. */
  url?: string;
  status: SetuConsentStatus;
  redirectUrl?: string;
  detail?: SetuConsentDetail;
  context?: unknown;
  usage?: unknown;
  tags?: string[];
  traceId?: string;
}

// ─── Data Sessions (FI fetch) ─────────────────────────────────────────────────

/** Body for `POST /sessions`. */
export interface SetuSessionRequest {
  consentId: string;
  dataRange: SetuDateRange;
  format: 'json' | 'xml';
}

/** Per-account delivery status inside a session. */
export type SetuFIStatus =
  | 'PENDING'
  | 'READY'
  | 'DELIVERED'
  | 'TIMEOUT'
  | 'DENIED';

/** A single account row inside a session's fip.accounts[]. */
export interface SetuFIPAccount {
  /** Stable account identifier — use as the canonical account id. */
  linkRefNumber: string;
  maskedAccNumber: string;
  status: SetuFIStatus;
  /** Account + transactions payload (present when status === 'DELIVERED'). */
  data?: {
    account: SetuAccountData;
  };
}

/** A FIP block within a data session — wraps one or more delivered accounts. */
export interface SetuFIP {
  fipID: string;
  accounts: SetuFIPAccount[];
}

/** Session lifecycle states. */
export type SetuSessionStatus =
  | 'PENDING'
  | 'PARTIAL'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'FAILED';

/** Session object returned by `POST /sessions` and `GET /sessions/:id`. */
export interface SetuSession {
  id: string;
  status: SetuSessionStatus;
  consentId: string;
  format: 'json' | 'xml';
  dataRange: SetuDateRange;
  fips?: SetuFIP[];
  traceId?: string;
}

// ─── Account / Transaction data shapes ────────────────────────────────────────

export interface SetuAccountProfileHolder {
  name?: string;
  pan?: string;
  mobile?: string;
  email?: string;
  [k: string]: unknown;
}

export interface SetuAccountProfile {
  holders: {
    type?: string;
    holder?: SetuAccountProfileHolder;
  };
}

export interface SetuAccountSummary {
  /** STRING decimal — e.g. "101666.33". */
  currentBalance: string;
  currency: string;
  ifscCode?: string;
  type?: string; // SAVINGS | CURRENT | ...
  status?: string; // ACTIVE | ...
  branch?: string;
  openingDate?: string;
  balanceDateTime?: string;
  currentODLimit?: string;
  drawingLimit?: string;
  [k: string]: unknown;
}

/** A single Setu transaction (inside `transactions.transaction[]`). */
export interface SetuTransaction {
  txnId: string;
  amount: string; // STRING decimal
  type: 'CREDIT' | 'DEBIT';
  mode?: string; // UPI | IMPS | NEFT | RTGS | ATM | CASH | CHEQUE
  narration?: string;
  reference?: string;
  transactionTimestamp?: string;
  valueDate?: string;
  currentBalance?: string;
}

export interface SetuTransactions {
  startDate?: string;
  endDate?: string;
  transaction?: SetuTransaction[];
}

/** The full account payload Setu delivers inside `data.account`. */
export interface SetuAccountData {
  linkedAccRef?: string;
  maskedAccNumber?: string;
  type?: string;
  version?: string;
  profile?: SetuAccountProfile;
  summary?: SetuAccountSummary;
  transactions?: SetuTransactions;
}

// ─── FIPs (banks) ─────────────────────────────────────────────────────────────

/** Bank/FIP info from `GET /v2/fips`. */
export interface SetuFIPInfo {
  name: string;
  fipId: string;
  fiTypes?: string[];
  institutionType?: string;
  status?: string;
  consentConversionRate?: number;
  dataFetchSuccessRate?: number;
  aaWiseSuccessRate?: unknown;
}

/** Response shape from `GET /v2/fips` and `GET /v2/fips/:id`. */
export interface SetuFIPListResponse {
  data: SetuFIPInfo[];
  traceId?: string;
}

// ─── Account availability ─────────────────────────────────────────────────────

export interface SetuAvailabilityResult {
  aa: string;
  vua: string;
  status: boolean;
}

export interface SetuAvailabilityResponse {
  accounts: SetuAvailabilityResult[];
  traceId?: string;
}

// ─── Linked accounts (consent detail + webhooks) ──────────────────────────────

/** A linked account as reported inside a consent `detail.accounts[]` or webhook payload. */
export interface SetuLinkedAccount {
  maskedAccNumber: string;
  accType: string;
  fipId: string;
  fiType: string;
  linkRefNumber: string;
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────

export type SetuWebhookEventType =
  | 'CONSENT_STATUS_UPDATE'
  | 'SESSION_STATUS_UPDATE'
  | 'FI_DATA_READY';

export interface SetuWebhookSessionAccount {
  FIStatus: SetuFIStatus;
  linkRefNumber: string;
}

export interface SetuWebhookSessionFip {
  fipID: string;
  accounts: SetuWebhookSessionAccount[];
}

export interface SetuWebhookConsentData {
  status: SetuConsentStatus;
  detail: {
    accounts?: SetuLinkedAccount[];
    [k: string]: unknown;
  };
}

export interface SetuWebhookSessionData {
  status: SetuSessionStatus;
  fips?: SetuWebhookSessionFip[];
  [k: string]: unknown;
}

export interface SetuWebhookFIDataEntry {
  linkRefNumber: string;
  maskedAccNumber?: string;
  decryptedFI?: {
    account: SetuAccountData;
  };
}

export interface SetuWebhookFIReadyData {
  dataRange?: SetuDateRange;
  fiData?: Array<{
    fipID: string;
    data: SetuWebhookFIDataEntry[];
  }>;
  [k: string]: unknown;
}

/** A parsed Setu webhook event. The `data` shape varies by `type`. */
export interface SetuWebhookEvent {
  type: SetuWebhookEventType;
  timestamp: string;
  consentId?: string;
  dataSessionId?: string;
  success: boolean;
  data: SetuWebhookConsentData | SetuWebhookSessionData | SetuWebhookFIReadyData | unknown;
  error?: SetuError;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

/** Setu's error object inside error envelopes. */
export interface SetuError {
  code?: string;
  detail?: string;
  title?: string;
  traceID?: string;
  docURL?: string;
  errors?: Array<{ field?: string; message?: string; code?: string }>;
}

/**
 * Normalized error class for the Setu SDK. Every Setu HTTP failure is wrapped
 * in a `SetuApiError` so callers can branch on `isRetryable` without inspecting
 * the raw response.
 */
export class SetuApiError extends Error {
  /** HTTP status code from the response (or 0 for network/timeout errors). */
  readonly status: number;
  /** Setu error code (e.g. "invalid-api-key"). */
  readonly code: string;
  /** Setu trace id (for support escalation). */
  readonly traceId?: string;
  /** True for 429/5xx — caller may retry with backoff. False for 4xx (auth/validation). */
  readonly isRetryable: boolean;

  constructor(opts: {
    message: string;
    status?: number;
    code?: string;
    traceId?: string;
    isRetryable?: boolean;
    cause?: unknown;
  }) {
    super(opts.message);
    this.name = 'SetuApiError';
    this.status = opts.status ?? 0;
    this.code = opts.code ?? 'unknown';
    this.traceId = opts.traceId;
    this.isRetryable = opts.isRetryable ?? false;
    if (opts.cause !== undefined) {
      // Preserve the original error for stack traces (Node 16.9+).
      (this as { cause?: unknown }).cause = opts.cause;
    }
  }
}
