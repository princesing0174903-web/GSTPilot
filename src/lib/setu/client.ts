// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Setu SDK — Centralized HTTP Client (retry, rate-limit, logging)
// ═══════════════════════════════════════════════════════════════════════════════
//
// All Setu AA gateway traffic flows through `SetuClient.request()`. This gives
// us ONE place to enforce:
//   - Authorization header (auto-refreshing the OAuth token)
//   - x-product-instance-id header (required on every AA request)
//   - Per-request timeout (AbortSignal.timeout)
//   - 401 single-retry (invalidate token, refresh, retry ONCE — not counted
//     against maxRetries so transient auth blips don't burn a retry budget)
//   - 429/5xx exponential backoff with jitter + Retry-After honoring
//   - Rate limiting (max 5 concurrent, ~10 RPS — Setu doesn't document limits
//     so we're defensive)
//   - Structured logging of every request (method, path, status, durationMs)
//
// The public methods (`createConsent`, `getConsent`, ...) are thin wrappers
// over `request()`.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  SetuAvailabilityResponse,
  SetuAvailabilityResult,
  SetuConfig,
  SetuConsent,
  SetuConsentRequest,
  SetuError,
  SetuFIPInfo,
  SetuFIPListResponse,
  SetuSession,
  SetuSessionRequest,
} from './types';
import { SetuApiError } from './types';
import { SetuAuth } from './auth';
import { backoffMs, isRetryableStatus, loadSetuConfig, setuLogger, sleep } from './utils';

// ─── Rate limiter (max concurrency + min-interval) ────────────────────────────

/**
 * Tiny async gate that caps concurrency AND enforces a minimum interval between
 * request starts. Setu doesn't document rate limits; we default to 5 concurrent
 * requests with 100ms minimum spacing (~10 RPS ceiling).
 */
class RateLimiter {
  private active = 0;
  private lastDispatch = 0;
  private readonly queue: Array<() => void> = [];
  constructor(
    private readonly maxConcurrent: number,
    private readonly minIntervalMs: number,
  ) {}

  /** Acquire a slot. Resolves when concurrency + interval constraints allow. */
  async acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      const now = Date.now();
      const wait = Math.max(0, this.lastDispatch + this.minIntervalMs - now);
      if (wait > 0) await sleep(wait);
      this.lastDispatch = Date.now();
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.lastDispatch = Date.now();
    this.active++;
  }

  release(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.queue.shift();
    if (next) next();
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

// ─── Client ───────────────────────────────────────────────────────────────────

/**
 * Centralized Setu HTTP client. One instance per process, cached on
 * `globalThis.__SETU_CLIENT__` via `getSetuClient()`.
 */
export class SetuClient {
  private readonly config: SetuConfig;
  private readonly auth: SetuAuth;
  private readonly limiter: RateLimiter;

  constructor(config: SetuConfig) {
    this.config = config;
    this.auth = new SetuAuth(config);
    // Defensive defaults: 5 concurrent, 100ms spacing.
    this.limiter = new RateLimiter(5, 100);
  }

  /** Expose the underlying auth manager (used by token-refresh-test route). */
  getAuth(): SetuAuth {
    return this.auth;
  }

  // ─── Core request ──────────────────────────────────────────────────────────

  /**
   * Issue an authenticated request to the Setu AA gateway. Handles auth,
   * timeout, retry, and rate-limiting uniformly. Returns parsed JSON.
   *
   * @param method HTTP verb
   * @param path Path under baseUrl (e.g. "/v2/consents")
   * @param body Optional JSON-serializable request body
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    return this.limiter.run(() => this.requestWithRetry(method, path, body, 0, false));
  }

  /**
   * Inner request loop. `attempt` is the retry counter for 429/5xx. `did401Retry`
   * ensures we only retry a 401 ONCE (the spec mandates this).
   */
  private async requestWithRetry<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body: unknown,
    attempt: number,
    did401Retry: boolean,
  ): Promise<T> {
    const token = await this.auth.getAccessToken();
    const url = this.config.baseUrl + path;
    const startedAt = Date.now();

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'x-product-instance-id': this.config.productInstanceId,
          'Content-Type': 'application/json',
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 15000),
      });
    } catch (err) {
      const elapsed = Date.now() - startedAt;
      // Network / timeout / abort. These are typically retryable.
      const isAbort =
        err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
      setuLogger.error('Request failed (network)', {
        method,
        path,
        elapsedMs: elapsed,
        isAbort,
      });
      if (attempt < (this.config.maxRetries ?? 3)) {
        await sleep(backoffMs(attempt));
        return this.requestWithRetry(method, path, body, attempt + 1, did401Retry);
      }
      throw new SetuApiError({
        message: `Setu request to ${path} failed: ${err instanceof Error ? err.message : 'network error'}`,
        status: 0,
        code: isAbort ? 'timeout' : 'network_error',
        isRetryable: true,
        cause: err,
      });
    }

    const elapsed = Date.now() - startedAt;

    // ── 401: refresh token, retry ONCE (not counted against maxRetries) ──
    if (res.status === 401 && !did401Retry) {
      setuLogger.warn('Received 401 — refreshing token and retrying once', {
        method,
        path,
        elapsedMs: elapsed,
      });
      this.auth.invalidateToken();
      return this.requestWithRetry(method, path, body, attempt, true);
    }

    // ── Retryable status (429 / 5xx): backoff + retry ──
    if (isRetryableStatus(res.status) && attempt < (this.config.maxRetries ?? 3)) {
      const retryAfterHeader = res.headers.get('Retry-After');
      let wait = backoffMs(attempt);
      if (retryAfterHeader) {
        const secs = Number(retryAfterHeader);
        if (Number.isFinite(secs) && secs > 0) {
          // Honor Retry-After but cap at 10s so a misbehaving server can't stall us.
          wait = Math.min(10_000, secs * 1000);
        }
      }
      setuLogger.warn('Received retryable status — backing off', {
        method,
        path,
        status: res.status,
        attempt,
        waitMs: wait,
      });
      await sleep(wait);
      return this.requestWithRetry(method, path, body, attempt + 1, did401Retry);
    }

    // ── Parse JSON (may be empty on 204) ──
    let parsed: unknown = null;
    const text = await res.text();
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        // Non-JSON response — surface as an error.
        throw new SetuApiError({
          message: `Setu response was not valid JSON (status ${res.status}): ${text.slice(0, 200)}`,
          status: res.status,
          code: 'parse_error',
          isRetryable: false,
        });
      }
    }

    if (!res.ok) {
      const errObj = (parsed as { error?: SetuError } | null)?.error;
      const code = errObj?.code ?? `http_${res.status}`;
      const detail = errObj?.detail ?? `Setu returned status ${res.status}`;
      setuLogger.error('Request rejected', {
        method,
        path,
        status: res.status,
        code,
        elapsedMs: elapsed,
      });
      throw new SetuApiError({
        message: detail,
        status: res.status,
        code,
        traceId: errObj?.traceID,
        isRetryable: isRetryableStatus(res.status) && attempt < (this.config.maxRetries ?? 3),
      });
    }

    setuLogger.debug('Request ok', { method, path, status: res.status, elapsedMs: elapsed });
    return parsed as T;
  }

  // ─── Consent endpoints ─────────────────────────────────────────────────────

  /** `POST /v2/consents` — initiate a consent request. */
  async createConsent(req: SetuConsentRequest): Promise<SetuConsent> {
    return this.request<SetuConsent>('POST', '/v2/consents', req);
  }

  /** `GET /v2/consents/:id` — poll consent status (and detail.accounts after approval). */
  async getConsent(id: string): Promise<SetuConsent> {
    return this.request<SetuConsent>('GET', `/v2/consents/${encodeURIComponent(id)}`);
  }

  /** `POST /v2/consents/:id/revoke` — revoke a consent. */
  async revokeConsent(id: string): Promise<{ status: string }> {
    return this.request<{ status: string }>(
      'POST',
      `/v2/consents/${encodeURIComponent(id)}/revoke`,
      {},
    );
  }

  // ─── Data session endpoints (V1 paths on V2 host — verified working) ───────

  /** `POST /sessions` — start a data fetch for an active consent. */
  async createSession(req: SetuSessionRequest): Promise<SetuSession> {
    return this.request<SetuSession>('POST', '/sessions', req);
  }

  /** `GET /sessions/:id` — poll session status + retrieve FI data when COMPLETED. */
  async getSession(id: string): Promise<SetuSession> {
    return this.request<SetuSession>('GET', `/sessions/${encodeURIComponent(id)}`);
  }

  // ─── FIPs ──────────────────────────────────────────────────────────────────

  /** `GET /v2/fips` — list all FIPs (optionally filtered by status). */
  async listFips(status?: 'ACTIVE' | 'INACTIVE'): Promise<SetuFIPInfo[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await this.request<SetuFIPListResponse>('GET', `/v2/fips${qs}`);
    return res.data ?? [];
  }

  /** `GET /v2/fips/:id` — fetch a single FIP. Returns null if not found. */
  async getFip(id: string): Promise<SetuFIPInfo | null> {
    try {
      const res = await this.request<SetuFIPListResponse>(
        'GET',
        `/v2/fips/${encodeURIComponent(id)}`,
      );
      return res.data?.[0] ?? null;
    } catch (err) {
      if (err instanceof SetuApiError && err.status === 404) return null;
      throw err;
    }
  }

  // ─── Account availability ──────────────────────────────────────────────────

  /** `POST /v2/account-availability` — check if a mobile number is registered with any AA. */
  async checkAvailability(mobile: string): Promise<SetuAvailabilityResult[]> {
    const res = await this.request<SetuAvailabilityResponse>(
      'POST',
      '/v2/account-availability',
      { mobileNumber: mobile },
    );
    return res.accounts ?? [];
  }

  // ─── Health check ──────────────────────────────────────────────────────────

  /**
   * Verify end-to-end connectivity by getting a token + listing FIPs. Used by
   * the `/api/banking-intel/connection-test` route.
   */
  async healthCheck(): Promise<{
    ok: boolean;
    latencyMs: number;
    authOk: boolean;
    fipCount?: number;
    error?: string;
  }> {
    const startedAt = Date.now();
    try {
      await this.auth.getAccessToken();
      const fips = await this.listFips('ACTIVE');
      return {
        ok: true,
        latencyMs: Date.now() - startedAt,
        authOk: true,
        fipCount: fips.length,
      };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        authOk: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

// ─── Singleton accessor ───────────────────────────────────────────────────────

/**
 * Typed accessor for the globalThis slot we cache the SetuClient on. We use a
 * typed record view of globalThis (instead of `declare global` + `var`) to
 * keep the module strict-mode clean.
 */
const GLOBAL = globalThis as unknown as {
  __SETU_CLIENT__?: SetuClient;
};

let cachedClient: SetuClient | null = null;

/**
 * Return the process-wide SetuClient singleton. Returns `null` (with a single
 * console.warn) if Setu isn't configured. Callers must handle the null case
 * (typically by falling back to MockBankingProvider).
 */
export function getSetuClient(): SetuClient | null {
  if (GLOBAL.__SETU_CLIENT__) return GLOBAL.__SETU_CLIENT__;
  if (cachedClient) return cachedClient;

  const config = loadSetuConfig();
  if (!config) {
    // loadSetuConfig already warned.
    return null;
  }
  cachedClient = new SetuClient(config);
  GLOBAL.__SETU_CLIENT__ = cachedClient;
  setuLogger.info('SetuClient initialized', {
    baseUrl: config.baseUrl,
    productInstanceId: config.productInstanceId.slice(0, 4) + '••••',
  });
  return cachedClient;
}
