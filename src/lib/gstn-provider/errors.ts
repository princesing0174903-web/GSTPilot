// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real GSTN Integration™ — Typed Errors
//
// Every failure mode in the GSTN flow has a dedicated error class so callers
// can branch on `instanceof` and show the right UX (retry vs re-auth vs
// contact-support). All errors are PURE classes — safe for client + server.
// ═══════════════════════════════════════════════════════════════════════════════

/** Base class for every GSTN error. Carries a machine-readable `code`. */
export class GSTNError extends Error {
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
    this.code = opts.code ?? 'GSTN_ERROR';
    this.statusCode = opts.statusCode ?? 500;
    this.retryable = opts.retryable ?? false;
    // Preserve the cause chain (Node 16+/modern browsers).
    if (opts.cause !== undefined) {
      (this as { cause?: unknown }).cause = opts.cause;
    }
  }
}

/** OTP has expired — user must request a new one. */
export class OTPExpiredError extends GSTNError {
  constructor(message = 'The OTP has expired. Please request a new one.') {
    super(message, { code: 'OTP_EXPIRED', statusCode: 410, retryable: false });
  }
}

/** The OTP value was invalid (wrong digits, already used, etc.). */
export class OTPInvalidError extends GSTNError {
  constructor(message = 'The OTP you entered is invalid. Please try again.') {
    super(message, { code: 'OTP_INVALID', statusCode: 400, retryable: true });
  }
}

/** Session has expired — user must refresh or re-authenticate. */
export class SessionExpiredError extends GSTNError {
  constructor(message = 'Your GST session has expired. Please reconnect.') {
    super(message, { code: 'SESSION_EXPIRED', statusCode: 401, retryable: false });
  }
}

/** GSTN service is unavailable (5xx from upstream, maintenance, etc.). */
export class GSTUnavailableError extends GSTNError {
  constructor(message = 'The GST portal is temporarily unavailable. Please try again later.') {
    super(message, { code: 'GST_UNAVAILABLE', statusCode: 503, retryable: true });
  }
}

/** GSTN rate-limited the request — caller should back off and retry. */
export class RateLimitError extends GSTNError {
  /** Suggested wait in milliseconds before retrying. */
  readonly retryAfterMs: number;

  constructor(message = 'Too many requests to GST. Please wait a moment and try again.', retryAfterMs = 30_000) {
    super(message, {
      code: 'RATE_LIMITED',
      statusCode: 429,
      retryable: true,
    });
    this.retryAfterMs = retryAfterMs;
  }
}

/** A request to GSTN timed out. */
export class TimeoutError extends GSTNError {
  constructor(message = 'The request to GST timed out. Please try again.') {
    super(message, { code: 'TIMEOUT', statusCode: 504, retryable: true });
  }
}

/** Authentication failed (bad credentials, revoked session, etc.). */
export class AuthenticationError extends GSTNError {
  constructor(message = 'GST authentication failed. Please check your credentials.') {
    super(message, { code: 'AUTH_FAILED', statusCode: 401, retryable: false });
  }
}

/** Input validation failed before even calling the provider. */
export class ValidationError extends GSTNError {
  constructor(message = 'Invalid input.', readonly fields?: Record<string, string>) {
    super(message, { code: 'VALIDATION_ERROR', statusCode: 400, retryable: false });
  }
}

/** The organization has no GST connection — user must connect first. */
export class NotConnectedError extends GSTNError {
  constructor(message = 'No GST connection found. Please connect your GST account first.') {
    super(message, { code: 'NOT_CONNECTED', statusCode: 409, retryable: false });
  }
}

/**
 * Thrown by FutureOfficialGSTProvider for every method — signals that the
 * production GSTN integration is not yet enabled. Callers should fall back to
 * the mock provider or surface a clear "feature not available" message.
 */
export class NotImplementedError extends GSTNError {
  constructor(feature = 'This GSTN operation') {
    super(
      `${feature} is not available yet. Production GSTN integration is not enabled. Set GSTN_PROVIDER=official and configure GSTN credentials to enable.`,
      { code: 'NOT_IMPLEMENTED', statusCode: 501, retryable: false },
    );
  }
}

/**
 * Convert an unknown error into a human-readable message suitable for display
 * to the end user. Maps known GSTN errors to friendly copy; falls back to the
 * raw message for unknown errors.
 */
export function friendlyGSTNError(err: unknown): string {
  if (err instanceof GSTNError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Determine whether an error is worth retrying (with backoff).
 * Used by the sync scheduler and the client retry logic.
 */
export function isRetryableGSTNError(err: unknown): boolean {
  if (err instanceof GSTNError) return err.retryable;
  // Network failures, ECONNRESET, etc. are retryable.
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
