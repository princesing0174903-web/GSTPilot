// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI Production Pipeline™ — Typed Errors
//
// Every failure mode in the AI pipeline has a dedicated error class so callers
// can branch on `instanceof` and show the right UX (retry vs re-auth vs
// contact-support). All errors are PURE classes — safe for client + server.
// ═══════════════════════════════════════════════════════════════════════════════

/** Base class for every AI pipeline error. Carries a machine-readable `code`. */
export class GenError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(
    message: string,
    opts: { code?: string; statusCode?: number; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = opts.code ?? 'GEN_ERROR';
    this.statusCode = opts.statusCode ?? 500;
    this.retryable = opts.retryable ?? false;
    if (opts.cause !== undefined) {
      (this as { cause?: unknown }).cause = opts.cause;
    }
  }
}

/** The AI provider rate-limited the request. */
export class RateLimitError extends GenError {
  readonly retryAfterMs: number;
  constructor(message = 'The AI provider rate-limited the request. Please wait and try again.', retryAfterMs = 30_000) {
    super(message, { code: 'RATE_LIMITED', statusCode: 429, retryable: true });
    this.retryAfterMs = retryAfterMs;
  }
}

/** The AI provider is unavailable (5xx, maintenance, etc.). */
export class ProviderUnavailableError extends GenError {
  constructor(message = 'The AI provider is temporarily unavailable. Please try again later.') {
    super(message, { code: 'PROVIDER_UNAVAILABLE', statusCode: 503, retryable: true });
  }
}

/** A request to the AI provider timed out. */
export class TimeoutError extends GenError {
  constructor(message = 'The generation request timed out. Please try again.') {
    super(message, { code: 'TIMEOUT', statusCode: 504, retryable: true });
  }
}

/** The AI provider rejected the input (invalid prompt, content policy, etc.). */
export class InvalidInputError extends GenError {
  constructor(message = 'The AI provider rejected the input.') {
    super(message, { code: 'INVALID_INPUT', statusCode: 400, retryable: false });
  }
}

/** Authentication failed (bad API key, revoked, etc.). */
export class AuthenticationError extends GenError {
  constructor(message = 'AI provider authentication failed. Check the API key configuration.') {
    super(message, { code: 'AUTH_FAILED', statusCode: 401, retryable: false });
  }
}

/** Input validation failed before even calling the provider. */
export class ValidationError extends GenError {
  constructor(message = 'Invalid input.', readonly fields?: Record<string, string>) {
    super(message, { code: 'VALIDATION_ERROR', statusCode: 400, retryable: false });
  }
}

/** The job was cancelled before completion. */
export class JobCancelledError extends GenError {
  constructor(message = 'The job was cancelled.') {
    super(message, { code: 'CANCELLED', statusCode: 409, retryable: false });
  }
}

/** The job cannot be transitioned to the requested state. */
export class IllegalStateTransitionError extends GenError {
  constructor(message = 'This job cannot be modified in its current state.') {
    super(message, { code: 'ILLEGAL_TRANSITION', statusCode: 409, retryable: false });
  }
}

/** The job was not found (deleted or never existed). */
export class JobNotFoundError extends GenError {
  constructor(message = 'Generation job not found.') {
    super(message, { code: 'JOB_NOT_FOUND', statusCode: 404, retryable: false });
  }
}

/**
 * Thrown by FutureOfficialGenProvider for every method — signals that the
 * production AI integration is not yet enabled. Callers should fall back to
 * the mock provider or surface a clear "feature not available" message.
 */
export class NotImplementedError extends GenError {
  constructor(feature = 'This AI operation') {
    super(
      `${feature} is not available yet. Production AI integration is not enabled. Set AI_PROVIDER=official and configure API keys to enable.`,
      { code: 'NOT_IMPLEMENTED', statusCode: 501, retryable: false },
    );
  }
}

/**
 * Convert an unknown error into a human-readable message suitable for display.
 */
export function friendlyGenError(err: unknown): string {
  if (err instanceof GenError) return err.message;
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Determine whether an error is worth retrying (with backoff).
 * Used by the background processor and the client retry logic.
 */
export function isRetryableGenError(err: unknown): boolean {
  if (err instanceof GenError) return err.retryable;
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
