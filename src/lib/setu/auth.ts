// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Setu SDK — OAuth2 Token Manager (single-flight refresh)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Setu uses OAuth2 client_credentials. Tokens are RS256-signed JWTs valid for
// 30 minutes (1800s). We cache the token + expiry, refresh proactively when
// within 60s of expiry, and refresh reactively on a 401 (handled by SetuClient).
//
// Single-flight: if a refresh is in-flight, concurrent callers await the SAME
// promise instead of kicking off parallel `POST /auth/token` calls. This
// matters because BankingService methods are called in bursty fan-out patterns
// (dashboard, cashflow, forecast all hit Setu at once).
// ═══════════════════════════════════════════════════════════════════════════════

import type { SetuConfig, SetuTokenResponse } from './types';
import { SetuApiError } from './types';
import { maskString, setuLogger, sleep } from './utils';

/** 60s safety margin — refresh before the token actually expires. */
const EXPIRY_SAFETY_MS = 60_000;

/**
 * OAuth2 token manager. One instance lives inside each `SetuClient`.
 *
 * Usage:
 *   const auth = new SetuAuth(config);
 *   const token = await auth.getAccessToken();      // cached or refreshed
 *   auth.invalidateToken();                          // on 401 — forces next get to refresh
 */
export class SetuAuth {
  private readonly config: SetuConfig;
  private token: string | null = null;
  private expiresAt = 0;
  private refreshPromise: Promise<string> | null = null;

  constructor(config: SetuConfig) {
    this.config = config;
  }

  /**
   * Return a valid access token. Uses the cached token if it's still valid;
   * otherwise triggers a single-flight refresh. Concurrent callers share one
   * refresh promise.
   */
  async getAccessToken(): Promise<string> {
    if (this.token && Date.now() < this.expiresAt) {
      return this.token;
    }
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    this.refreshPromise = this.refreshToken();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Force a fresh token from Setu's OAuth endpoint. Caches it with a 60s safety
   * margin. Auth failures (400 / network) throw `SetuApiError` with
   * `isRetryable: false` — caller should NOT retry auth errors.
   */
  async refreshToken(): Promise<string> {
    setuLogger.debug('Refreshing OAuth token', {
      authUrl: this.config.authUrl,
      clientId: maskString(this.config.clientId, 4, 2),
    });

    const body = JSON.stringify({
      clientID: this.config.clientId,
      secret: this.config.clientSecret,
    });

    let res: Response;
    try {
      res = await fetch(this.config.authUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 15000),
      });
    } catch (err) {
      setuLogger.error('OAuth token fetch failed (network)', {
        error: err instanceof Error ? err.message : String(err),
      });
      throw new SetuApiError({
        message: `Setu OAuth request failed: ${err instanceof Error ? err.message : 'network error'}`,
        status: 0,
        code: 'auth_network_error',
        isRetryable: false,
        cause: err,
      });
    }

    let parsed: SetuTokenResponse | null = null;
    try {
      parsed = (await res.json()) as SetuTokenResponse;
    } catch (err) {
      setuLogger.error('OAuth response not JSON', {
        status: res.status,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new SetuApiError({
        message: `Setu OAuth response was not valid JSON (status ${res.status})`,
        status: res.status,
        code: 'auth_parse_error',
        isRetryable: false,
        cause: err,
      });
    }

    if (!res.ok || !parsed.success || !parsed.data?.token) {
      const code = parsed.error?.code ?? 'auth_failed';
      const detail = parsed.error?.detail ?? `OAuth failed (status ${res.status})`;
      setuLogger.error('OAuth token rejected', { status: res.status, code });
      throw new SetuApiError({
        message: detail,
        status: res.status,
        code,
        traceId: parsed.error?.traceID ?? parsed.traceId,
        isRetryable: false,
      });
    }

    const token = parsed.data.token;
    const expiresInMs = (parsed.data.expiresIn ?? 1800) * 1000;
    this.token = token;
    this.expiresAt = Date.now() + expiresInMs - EXPIRY_SAFETY_MS;
    setuLogger.info('OAuth token refreshed', {
      expiresInSec: parsed.data.expiresIn,
      token: maskString(token, 6, 4),
    });
    return token;
  }

  /**
   * Invalidate the cached token. Called by `SetuClient` when a 401 is received
   * on an AA gateway request — the next `getAccessToken()` call will refresh.
   */
  invalidateToken(): void {
    this.token = null;
    this.expiresAt = 0;
    setuLogger.debug('Token invalidated (will refresh on next request)');
  }
}

/**
 * Wait briefly so a refreshed token can settle in concurrent code paths.
 * Exported for tests; not used by the client directly.
 */
export async function settleTokenRefresh(): Promise<void> {
  await sleep(0);
}
