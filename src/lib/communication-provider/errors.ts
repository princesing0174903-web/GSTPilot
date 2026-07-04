// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Gmail & WhatsApp Business Automation™ — Typed Errors
//
// Every failure mode in the communication flow has a dedicated error class so
// callers can branch on `instanceof` and show the right UX (retry vs re-auth vs
// contact-support). All errors are PURE classes — safe for client + server.
// ═══════════════════════════════════════════════════════════════════════════════

/** Base class for every communication error. Carries a machine-readable `code`. */
export class CommunicationError extends Error {
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
    this.code = opts.code ?? 'COMMUNICATION_ERROR';
    this.statusCode = opts.statusCode ?? 500;
    this.retryable = opts.retryable ?? false;
    if (opts.cause !== undefined) {
      (this as { cause?: unknown }).cause = opts.cause;
    }
  }
}

/** OAuth consent was rejected or cancelled by the user. */
export class AuthRejectedError extends CommunicationError {
  constructor(message = 'The Google / WhatsApp authorization was rejected. Please try again.') {
    super(message, { code: 'AUTH_REJECTED', statusCode: 410, retryable: false });
  }
}

/** The OAuth token / session has expired — user must re-authenticate. */
export class SessionExpiredError extends CommunicationError {
  constructor(message = 'Your Gmail / WhatsApp session has expired. Please reconnect.') {
    super(message, { code: 'SESSION_EXPIRED', statusCode: 401, retryable: false });
  }
}

/** The communication provider service is unavailable (5xx, maintenance, etc.). */
export class ProviderUnavailableError extends CommunicationError {
  constructor(message = 'The communication service is temporarily unavailable. Please try again later.') {
    super(message, { code: 'PROVIDER_UNAVAILABLE', statusCode: 503, retryable: true });
  }
}

/** The provider rate-limited the request — caller should back off and retry. */
export class RateLimitError extends CommunicationError {
  /** Suggested wait in milliseconds before retrying. */
  readonly retryAfterMs: number;

  constructor(
    message = 'Too many requests to the communication service. Please wait a moment and try again.',
    retryAfterMs = 30_000,
  ) {
    super(message, { code: 'RATE_LIMITED', statusCode: 429, retryable: true });
    this.retryAfterMs = retryAfterMs;
  }
}

/** A request to the communication provider timed out. */
export class TimeoutError extends CommunicationError {
  constructor(message = 'The request to the communication provider timed out. Please try again.') {
    super(message, { code: 'TIMEOUT', statusCode: 504, retryable: true });
  }
}

/** Authentication failed (bad credentials, revoked token, etc.). */
export class AuthenticationError extends CommunicationError {
  constructor(message = 'Communication authentication failed. Please reconnect.') {
    super(message, { code: 'AUTH_FAILED', statusCode: 401, retryable: false });
  }
}

/** Input validation failed before even calling the provider. */
export class ValidationError extends CommunicationError {
  constructor(message = 'Invalid input.', readonly fields?: Record<string, string>) {
    super(message, { code: 'VALIDATION_ERROR', statusCode: 400, retryable: false });
  }
}

/** The organization has no Gmail / WhatsApp connection — user must connect first. */
export class NotConnectedError extends CommunicationError {
  constructor(message = 'No communication connection found. Please connect Gmail / WhatsApp first.') {
    super(message, { code: 'NOT_CONNECTED', statusCode: 409, retryable: false });
  }
}

/** A message send / schedule failed at the provider level. */
export class MessageSendError extends CommunicationError {
  constructor(message = 'Failed to send the message. Please try again.') {
    super(message, { code: 'SEND_FAILED', statusCode: 502, retryable: true });
  }
}

/** A scheduled message was not found or already processed. */
export class ScheduleNotFoundError extends CommunicationError {
  constructor(message = 'Scheduled message not found or already processed.') {
    super(message, { code: 'SCHEDULE_NOT_FOUND', statusCode: 404, retryable: false });
  }
}

/**
 * Thrown by every Future* provider for each method — signals that the
 * production communication integration is not yet enabled. Callers should fall
 * back to the mock provider or surface a clear "feature not available" message.
 */
export class NotImplementedError extends CommunicationError {
  constructor(feature = 'This communication operation') {
    super(
      `${feature} is not available yet. Production communication integration is not enabled. Set COMMUNICATION_GMAIL_PROVIDER=google or COMMUNICATION_WHATSAPP_PROVIDER=meta and configure the provider credentials to enable.`,
      { code: 'NOT_IMPLEMENTED', statusCode: 501, retryable: false },
    );
  }
}

/**
 * Convert an unknown error into a human-readable message suitable for display
 * to the end user.
 */
export function friendlyCommunicationError(err: unknown): string {
  if (err instanceof CommunicationError) return err.message;
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Determine whether an error is worth retrying (with backoff).
 */
export function isRetryableCommunicationError(err: unknown): boolean {
  if (err instanceof CommunicationError) return err.retryable;
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
