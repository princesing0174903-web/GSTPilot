// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Friendly Error Recovery
//
// Converts raw technical errors into friendly, actionable user messages.
// Detects network issues (for auto-retry) vs. permanent failures (for manual
// retry). Never exposes "Failed to fetch", "AbortError", HTTP codes, or stack
// traces to the end user.
// ═══════════════════════════════════════════════════════════════════════════════

export interface FriendlyError {
  /** Human-readable message safe to show in the UI. */
  message: string;
  /** True if the error is likely transient (network blip, 5xx) and worth auto-retry. */
  retryable: boolean;
  /** Short label for the retry button, e.g. "Try again" or "Reconnect". */
  retryLabel: string;
}

const NETWORK_HINTS = [
  'failed to fetch', 'networkerror', 'network request failed', 'load failed',
  'err_internet_disconnected', 'err_connection_reset', 'err_connection_refused',
  'err_name_not_resolved', 'err_network_changed', 'err_timed_out',
  'err_socket_not_connected', 'err_address_unreachable',
];

const TIMEOUT_HINTS = ['timed out', 'timeout', 'aborted', 'aborterror'];

const AUTH_HINTS = ['401', '403', 'unauthorized', 'forbidden', 'session'];

const SERVER_HINTS = ['500', '502', '503', '504', 'internal server error', 'bad gateway', 'service unavailable', 'gateway timeout'];

/**
 * Map a raw error (Error, string, unknown) into a friendly, user-facing result.
 * The message NEVER contains HTTP codes, stack traces, or raw fetch errors.
 */
export function toFriendlyError(err: unknown): FriendlyError {
  const raw = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();

  // User aborted — not really an error, but callers may pass it here.
  if (raw === 'aborted' || raw === 'aborterror' || raw.includes('user aborted')) {
    return {
      message: '',
      retryable: false,
      retryLabel: '',
    };
  }

  // Network / connectivity
  if (NETWORK_HINTS.some((h) => raw.includes(h))) {
    return {
      message: "I can't reach the server right now. Please check your internet connection and I'll try again.",
      retryable: true,
      retryLabel: 'Reconnect',
    };
  }

  // Timeout
  if (TIMEOUT_HINTS.some((h) => raw.includes(h))) {
    return {
      message: 'This is taking longer than expected. Please try again in a moment.',
      retryable: true,
      retryLabel: 'Try again',
    };
  }

  // Auth / session
  if (AUTH_HINTS.some((h) => raw.includes(h))) {
    return {
      message: 'Your session has expired. Please sign in again to continue.',
      retryable: false,
      retryLabel: 'Sign in',
    };
  }

  // Server error
  if (SERVER_HINTS.some((h) => raw.includes(h))) {
    return {
      message: "Oracle's services are briefly unavailable. Please try again in a moment.",
      retryable: true,
      retryLabel: 'Try again',
    };
  }

  // Generic fallback — never leak the raw error
  return {
    message: "I'm having trouble responding right now. Please try again in a moment.",
    retryable: true,
    retryLabel: 'Try again',
  };
}

/** True when the error looks like a transient network/timeout/5xx issue. */
export function isTransientError(err: unknown): boolean {
  return toFriendlyError(err).retryable;
}

/**
 * Execute an async operation with automatic retry on transient failures.
 * - Retries up to `maxRetries` times with exponential backoff (1s, 2s, 4s).
 * - Respects an optional AbortSignal.
 * - Returns the successful result or throws the last error (mapped to friendly).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxRetries?: number; signal?: AbortSignal; baseDelayMs?: number } = {}
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 3;
  const baseDelay = opts.baseDelayMs ?? 1000;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // AbortError should never be retried
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      // Only retry transient errors
      if (!isTransientError(err)) throw err;
      // Last attempt — don't wait, just fail
      if (attempt >= maxRetries - 1) break;
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}
