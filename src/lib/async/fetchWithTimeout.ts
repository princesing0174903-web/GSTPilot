// ═══════════════════════════════════════════════════════════════════════════════
// fetchWithTimeout — Production-grade fetch wrapper
// ═══════════════════════════════════════════════════════════════════════════════
//
// Wraps the native `fetch()` with:
//   • AbortController + default 30s timeout (configurable, 0 to disable)
//   • Optional retry with exponential backoff for transient errors (network/5xx)
//   • Standardized errors: `FetchTimeoutError` on timeout, `FetchHttpError` on
//     non-2xx responses (after attempting to parse the JSON error body).
//
// Usage:
//   import { fetchWithTimeout, FetchTimeoutError } from '@/lib/async';
//   try {
//     const res = await fetchWithTimeout('/api/foo', { method: 'POST', body: ... }, { timeoutMs: 15000 });
//     const data = await res.json();
//   } catch (err) {
//     if (err instanceof FetchTimeoutError) { ... }
//   }
//
// You can pass an external AbortSignal via `opts.signal` — it will be composed
// with the internal timeout signal so either one aborting cancels the request.
// ═══════════════════════════════════════════════════════════════════════════════

export class FetchTimeoutError extends Error {
  readonly isTimeout = true;
  constructor(public url: string, public timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms: ${url}`);
    this.name = 'FetchTimeoutError';
  }
}

export class FetchHttpError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'FetchHttpError';
    this.status = status;
    this.body = body;
  }
}

export interface FetchWithTimeoutOptions extends RequestInit {
  /** Timeout in ms. Defaults to 30_000. Set to 0 to disable. */
  timeoutMs?: number;
  /** Number of retries for transient errors (network errors + 5xx). Defaults to 0. */
  retries?: number;
  /** Base delay in ms for exponential backoff (delay = baseDelay * 2^attempt). Defaults to 500. */
  retryDelayMs?: number;
}

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (err instanceof Error && err.name === 'AbortError') return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function doFetch(
  input: string | URL,
  init: RequestInit,
  externalSignal: AbortSignal | null,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const internalSignal = controller.signal;

  let onExternalAbort: (() => void) | null = null;
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else {
      onExternalAbort = () => controller.abort();
      externalSignal.addEventListener('abort', onExternalAbort);
    }
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  let timedOut = false;
  if (timeoutMs > 0) {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  }

  try {
    return await fetch(input, { ...init, signal: internalSignal });
  } catch (err) {
    if (timedOut) {
      throw new FetchTimeoutError(String(input), timeoutMs);
    }
    // If aborted by the external signal, propagate the original AbortError.
    if (externalSignal?.aborted || isAbortError(err)) {
      throw err;
    }
    throw err;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    if (externalSignal && onExternalAbort) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

/**
 * Wraps fetch with AbortController-based timeout + optional retry.
 * Throws `FetchTimeoutError` on timeout, `FetchHttpError` on non-2xx responses.
 */
export async function fetchWithTimeout(
  input: string | URL,
  options: FetchWithTimeoutOptions = {},
): Promise<Response> {
  const {
    timeoutMs = 30_000,
    retries = 0,
    retryDelayMs = 500,
    signal: externalSignal,
    ...rest
  } = options;

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await doFetch(input, rest, externalSignal ?? null, timeoutMs);

      if (!res.ok) {
        // Try to extract a friendly error message from the JSON body.
        let body: unknown = null;
        let message = `HTTP ${res.status} ${res.statusText}`;
        try {
          body = await res.clone().json();
          if (body && typeof body === 'object' && 'error' in body) {
            const msg = (body as Record<string, unknown>).error;
            if (typeof msg === 'string') message = msg;
          }
        } catch {
          // body isn't JSON — keep the generic message
        }

        const httpErr = new FetchHttpError(res.status, message, body);
        const isTransient = res.status >= 500 && res.status < 600;
        if (attempt < retries && isTransient) {
          lastError = httpErr;
          await sleep(retryDelayMs * Math.pow(2, attempt));
          continue;
        }
        throw httpErr;
      }

      return res;
    } catch (err) {
      // External abort — don't retry, propagate immediately.
      if (externalSignal?.aborted) {
        throw err;
      }

      // Timeout — don't retry (timeouts rarely recover on immediate retry).
      if (err instanceof FetchTimeoutError) {
        throw err;
      }

      // Network error ("Failed to fetch") — retry if allowed.
      const isNetwork = err instanceof TypeError;
      if (attempt < retries && isNetwork) {
        lastError = err;
        await sleep(retryDelayMs * Math.pow(2, attempt));
        continue;
      }

      throw err;
    }
  }

  // Exhausted retries.
  throw lastError ?? new Error('fetchWithTimeout: unknown failure');
}

/**
 * Parses a fetch response as JSON, returning a fallback if the body isn't valid
 * JSON (e.g. an HTML error page). Companion to `fetchWithTimeout`.
 */
export async function parseJsonSafely<T = unknown>(res: Response, fallback: T): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}
