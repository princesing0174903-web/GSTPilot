// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — Retry Wrapper with Meaningful Errors
//
// Enterprise-grade retry: exponential backoff, jitter, max attempts, and
// human-readable error messages with suggested next actions. Never surfaces
// raw API errors to the user.
// ═══════════════════════════════════════════════════════════════════════════════

export interface RetryOptions {
  maxAttempts?: number;        // default 3
  baseDelayMs?: number;        // default 200
  maxDelayMs?: number;         // default 2000
  retryableErrors?: Array<(err: unknown) => boolean>;
  operationName?: string;      // for error messages
}

export interface CFOError {
  code: string;
  message: string;             // human-readable
  retryable: boolean;
  suggestedAction?: string;
  rawError?: string;           // for audit logs only, never shown to user
}

/**
 * Run an async operation with exponential backoff retry. Returns either the
 * successful result or a structured CFOError that can be safely surfaced to
 * the user.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<{ ok: true; value: T } | { ok: false; error: CFOError }> {
  const {
    maxAttempts = 3,
    baseDelayMs = 200,
    maxDelayMs = 2000,
    retryableErrors = [isNetworkError, isTimeoutError, isRateLimitError],
    operationName = 'Oracle operation',
  } = options;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const value = await operation();
      return { ok: true, value };
    } catch (err) {
      lastError = err;

      // If this was the last attempt, don't retry
      if (attempt === maxAttempts) break;

      // Check if this error is retryable
      const isRetryable = retryableErrors.some((check) => check(err));
      if (!isRetryable) break;

      // Exponential backoff with jitter
      const delay = Math.min(
        maxDelayMs,
        baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 100,
      );
      await sleep(delay);
    }
  }

  // All retries exhausted (or non-retryable error)
  const cfoError = toCFOError(lastError, operationName);
  return { ok: false, error: cfoError };
}

// ─── Error classifiers ───────────────────────────────────────────────────────

function isNetworkError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('econnreset') ||
      msg.includes('econnrefused') ||
      msg.includes('etimedout') ||
      msg.includes('fetch failed') ||
      msg.includes('network request failed')
    );
  }
  return false;
}

function isTimeoutError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted');
  }
  return false;
}

function isRateLimitError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('rate limit') || msg.includes('429') || msg.includes('too many requests');
  }
  return false;
}

// ─── Error translation ───────────────────────────────────────────────────────

function toCFOError(err: unknown, operationName: string): CFOError {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();

    // AI provider errors
    if (msg.includes('api key') || msg.includes('unauthorized') || msg.includes('401')) {
      return {
        code: 'AI_PROVIDER_AUTH_FAILED',
        message: `I couldn't authenticate with my AI provider. This usually means the API key is missing or invalid.`,
        retryable: false,
        suggestedAction: 'Ask your administrator to verify the AI provider settings in Settings → AI Providers.',
        rawError: err.message,
      };
    }

    if (msg.includes('rate limit') || msg.includes('429')) {
      return {
        code: 'AI_PROVIDER_RATE_LIMITED',
        message: `I'm being rate-limited by my AI provider. I've retried automatically but the limit persists.`,
        retryable: true,
        suggestedAction: 'Wait 30 seconds and try again. If this persists, contact your administrator.',
        rawError: err.message,
      };
    }

    if (msg.includes('timeout') || msg.includes('timed out')) {
      return {
        code: 'AI_PROVIDER_TIMEOUT',
        message: `My AI provider took too long to respond. I retried but it's still slow.`,
        retryable: true,
        suggestedAction: 'Try asking a more specific question, or try again in a moment.',
        rawError: err.message,
      };
    }

    if (msg.includes('network') || msg.includes('econnreset') || msg.includes('fetch failed')) {
      return {
        code: 'NETWORK_ERROR',
        message: `I couldn't reach the server. This is a network connectivity issue.`,
        retryable: true,
        suggestedAction: 'Check your internet connection and try again.',
        rawError: err.message,
      };
    }

    if (msg.includes('permission') || msg.includes('denied') || msg.includes('403')) {
      return {
        code: 'PERMISSION_DENIED',
        message: `You don't have permission to perform this action. Your role may not allow it.`,
        retryable: false,
        suggestedAction: 'Ask an administrator to grant you the required permission.',
        rawError: err.message,
      };
    }

    if (msg.includes('not found') || msg.includes('404')) {
      return {
        code: 'NOT_FOUND',
        message: `I couldn't find the record you're referring to. It may have been deleted.`,
        retryable: false,
        suggestedAction: 'Refresh the page and try again. If the issue persists, the record may no longer exist.',
        rawError: err.message,
      };
    }

    if (msg.includes('validation') || msg.includes('invalid')) {
      return {
        code: 'VALIDATION_ERROR',
        message: `The input I prepared didn't pass validation. This is likely a data quality issue.`,
        retryable: false,
        suggestedAction: 'Check the input values and try again. If this persists, the underlying data may need correction.',
        rawError: err.message,
      };
    }
  }

  // Generic fallback
  return {
    code: 'UNKNOWN_ERROR',
    message: `I ran into an unexpected issue while performing: ${operationName}. I've logged the details for review.`,
    retryable: false,
    suggestedAction: 'Try rephrasing your request. If the issue persists, contact support with the audit ID.',
    rawError: err instanceof Error ? err.message : String(err),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
