// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Oracle™ & AI CFO™ — Typed Errors
//
// Every failure mode in the AI flow has a dedicated error class so callers
// can branch on `instanceof` and show the right UX (retry vs re-auth vs
// contact-support). All errors are PURE classes — safe for client + server.
// ═══════════════════════════════════════════════════════════════════════════════

/** Base class for every AI error. Carries a machine-readable `code`. */
export class AIError extends Error {
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
    this.code = opts.code ?? 'AI_ERROR';
    this.statusCode = opts.statusCode ?? 500;
    this.retryable = opts.retryable ?? false;
    if (opts.cause !== undefined) {
      (this as { cause?: unknown }).cause = opts.cause;
    }
  }
}

/** Input validation failed (bad question, missing orgId, etc.). */
export class AIValidationError extends AIError {
  constructor(message = 'Invalid AI request.', readonly fields?: Record<string, string>) {
    super(message, { code: 'AI_VALIDATION_ERROR', statusCode: 400, retryable: false });
  }
}

/** The organization has no business data yet — Oracle cannot analyse nothing. */
export class NoBusinessDataError extends AIError {
  constructor(message = 'No business data found yet. Connect invoices, GST, or banking so Oracle can analyse your business.') {
    super(message, { code: 'NO_BUSINESS_DATA', statusCode: 409, retryable: false });
  }
}

/** The AI provider rate-limited the request — caller should back off and retry. */
export class AIRateLimitError extends AIError {
  /** Suggested wait in milliseconds before retrying. */
  readonly retryAfterMs: number;

  constructor(
    message = 'Too many AI requests. Please wait a moment and try again.',
    retryAfterMs = 30_000,
  ) {
    super(message, { code: 'AI_RATE_LIMITED', statusCode: 429, retryable: true });
    this.retryAfterMs = retryAfterMs;
  }
}

/** The AI provider service is unavailable (5xx, maintenance, etc.). */
export class AIProviderUnavailableError extends AIError {
  constructor(message = 'The AI service is temporarily unavailable. Please try again later.') {
    super(message, { code: 'AI_PROVIDER_UNAVAILABLE', statusCode: 503, retryable: true });
  }
}

/** A request to the AI provider timed out. */
export class AITimeoutError extends AIError {
  constructor(message = 'The AI request timed out. Please try again.') {
    super(message, { code: 'AI_TIMEOUT', statusCode: 504, retryable: true });
  }
}

/** Authentication failed (bad API key, revoked token, etc.). */
export class AIAuthenticationError extends AIError {
  constructor(message = 'AI authentication failed. Please check the provider credentials.') {
    super(message, { code: 'AI_AUTH_FAILED', statusCode: 401, retryable: false });
  }
}

/** Persisting or reading from the ai_memory collection failed. */
export class AIMemoryError extends AIError {
  constructor(message = 'Failed to access AI memory. Please try again.') {
    super(message, { code: 'AI_MEMORY_ERROR', statusCode: 500, retryable: true });
  }
}

/**
 * Thrown by every Future* provider for each method — signals that the
 * production AI integration is not yet enabled. Callers should fall back
 * to the mock provider or surface a clear "feature not available" message.
 */
export class NotImplementedError extends AIError {
  constructor(feature = 'This AI operation') {
    super(
      `${feature} is not available yet. Production AI integration is not enabled. Set AI_PROVIDER=<openai|gemini|claude> and configure the provider credentials to enable.`,
      { code: 'NOT_IMPLEMENTED', statusCode: 501, retryable: false },
    );
  }
}

/**
 * Convert an unknown error into a human-readable message suitable for display
 * to the end user. Maps known AI errors to friendly copy; falls back to the
 * raw message for unknown errors.
 */
export function friendlyAIError(err: unknown): string {
  if (err instanceof AIError) return err.message;
  if (err instanceof Error) return err.message;
  return 'An unexpected AI error occurred. Please try again.';
}

/**
 * Determine whether an error is worth retrying (with backoff).
 * Used by the background scheduler and the client retry logic.
 */
export function isRetryableAIError(err: unknown): boolean {
  if (err instanceof AIError) return err.retryable;
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
