// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Banking Foundation™ — Typed Errors
//
// Every failure mode in the banking flow has a dedicated error class so callers
// can branch on `instanceof` and show the right UX (retry vs re-auth vs
// contact-support). All errors are PURE classes — safe for client + server.
// ═══════════════════════════════════════════════════════════════════════════════

/** Base class for every banking error. Carries a machine-readable `code`. */
export class BankingError extends Error {
  /** Stable error code — use for branching, NOT for display. */
  readonly code: string;
  /** Optional HTTP status hint for API routes. */
  readonly statusCode: number;
  /** Whether retrying the same operation could succeed. */
  readonly retryable: boolean;

  constructor(
    message: string,
    opts: { code?: string; statusCode?: number; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = opts.code ?? 'BANKING_ERROR';
    this.statusCode = opts.statusCode ?? 500;
    this.retryable = opts.retryable ?? false;
    if (opts.cause !== undefined) {
      (this as { cause?: unknown }).cause = opts.cause;
    }
  }
}

/** Consent was rejected or cancelled by the user at the AA / bank side. */
export class ConsentRejectedError extends BankingError {
  constructor(message = 'The bank connection consent was rejected. Please try again.') {
    super(message, { code: 'CONSENT_REJECTED', statusCode: 410, retryable: false });
  }
}

/** The connection / consent has expired — user must re-connect. */
export class ConnectionExpiredError extends BankingError {
  constructor(message = 'Your bank connection has expired. Please reconnect.') {
    super(message, { code: 'CONNECTION_EXPIRED', statusCode: 401, retryable: false });
  }
}

/** The banking provider service is unavailable (5xx, maintenance, etc.). */
export class BankUnavailableError extends BankingError {
  constructor(message = 'The banking service is temporarily unavailable. Please try again later.') {
    super(message, { code: 'BANK_UNAVAILABLE', statusCode: 503, retryable: true });
  }
}

/** The provider rate-limited the request — caller should back off and retry. */
export class RateLimitError extends BankingError {
  /** Suggested wait in milliseconds before retrying. */
  readonly retryAfterMs: number;

  constructor(
    message = 'Too many requests to the banking service. Please wait a moment and try again.',
    retryAfterMs = 30_000,
  ) {
    super(message, { code: 'RATE_LIMITED', statusCode: 429, retryable: true });
    this.retryAfterMs = retryAfterMs;
  }
}

/** A request to the banking provider timed out. */
export class TimeoutError extends BankingError {
  constructor(message = 'The request to the bank timed out. Please try again.') {
    super(message, { code: 'TIMEOUT', statusCode: 504, retryable: true });
  }
}

/** Authentication failed (bad credentials, revoked consent, etc.). */
export class AuthenticationError extends BankingError {
  constructor(message = 'Bank authentication failed. Please check your credentials.') {
    super(message, { code: 'AUTH_FAILED', statusCode: 401, retryable: false });
  }
}

/** Input validation failed before even calling the provider. */
export class ValidationError extends BankingError {
  constructor(message = 'Invalid input.', readonly fields?: Record<string, string>) {
    super(message, { code: 'VALIDATION_ERROR', statusCode: 400, retryable: false });
  }
}

/** The organization has no bank connection — user must connect first. */
export class NotConnectedError extends BankingError {
  constructor(message = 'No bank connection found. Please connect your bank account first.') {
    super(message, { code: 'NOT_CONNECTED', statusCode: 409, retryable: false });
  }
}

/**
 * Thrown by every Future* provider for each method — signals that the
 * production banking integration is not yet enabled. Callers should fall back
 * to the mock provider or surface a clear "feature not available" message.
 */
export class NotImplementedError extends BankingError {
  constructor(feature = 'This banking operation') {
    super(
      `${feature} is not available yet. Production banking integration is not enabled. Set BANK_PROVIDER=<aa|razorpayx|setu|perfios|finvu> and configure the provider credentials to enable.`,
      { code: 'NOT_IMPLEMENTED', statusCode: 501, retryable: false },
    );
  }
}

/**
 * Convert an unknown error into a human-readable message suitable for display
 * to the end user. Maps known banking errors to friendly copy; falls back to
 * the raw message for unknown errors.
 */
export function friendlyBankingError(err: unknown): string {
  if (err instanceof BankingError) return err.message;
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Determine whether an error is worth retrying (with backoff).
 * Used by the sync scheduler and the client retry logic.
 */
export function isRetryableBankingError(err: unknown): boolean {
  if (err instanceof BankingError) return err.retryable;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('econnreset') ||
      msg.includes('econnrefused') ||
      msg.includes('etimedout') ||
      msg.includes('fetch failed')
    );
  }
  return false;
}
