// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Zoho Books OAuth Helper (server-only)
// ═══════════════════════════════════════════════════════════════════════════════
// This module is the SINGLE entry point for all server-side Zoho Books OAuth +
// API concerns:
//
//   • Scope definition (single ZohoBooks.fullaccess.all scope).
//   • Data-center resolution (ZOHO_DC env var, default `in`) + per-DC endpoints.
//   • OAuth config validation (isZohoConfigured / getZohoOAuthConfig).
//   • HMAC-signed OAuth state (16-byte nonce, 10-minute TTL, timingSafeEqual).
//   • Authorization-code exchange.
//   • Token persistence (AES-256-GCM via crypto.ts, upsert on org+user).
//   • Token refresh with `permanent` flag distinguishing revoked tokens
//     (400/401/403) from temporary failures (429/5xx/network).
//   • Connection status (live / stale / disconnected).
//   • Disconnect (mark revoked locally — Zoho has no revoke endpoint).
//   • Header-based org+user resolution (mirrors the Google integration).
//   • refreshOrganizationMapping — fetch the user's Zoho organizations list +
//     persist the primary org's ID + name on the ZohoBooksToken row.
//
// SECURITY:
//   • All credentials stay server-side (process.env only — never returned).
//   • Access + refresh tokens are AES-256-GCM encrypted at rest.
//   • OAuth state is HMAC-signed with a 10-minute TTL + 16-byte nonce + nonce
//     echoed in payload (defense against replay under same key).
//   • HMAC comparison uses `crypto.timingSafeEqual` (constant-time).
//   • Tenant isolation: every DB query is scoped by (organizationId, userId).
//   • Zoho access tokens NEVER returned to the frontend — only proxied
//     API responses (organizations, customers, invoices, bills, payments).
//
// DIFFERENCES FROM GOOGLE:
//   • Zoho uses data centers (in / com / eu / au / jp / ca) with different
//     account + API base URLs per DC. Configured via ZOHO_DC env var.
//   • Zoho has NO userinfo endpoint — we extract the Zoho user ID indirectly
//     from the token response (`api_domain`) + the organizations endpoint.
//   • Zoho has NO token-revoke endpoint — disconnect just marks the row
//     revoked locally. Zoho will eventually expire the access token.
//   • Zoho returns a `refresh_token` only on the initial consent (same as
//     Google) — we preserve the existing one on subsequent re-consents.
//   • Zoho Books is multi-tenant at the Zoho level: a Zoho user may have
//     multiple Zoho Books organizations. We persist the selected one's
//     `zohoOrgId` + `zohoOrgName` on the token row.
//   • Redirect URI comes from `ZOHO_REDIRECT_URI` env var (no dynamic
//     resolution — Zoho requires the redirect URI to be pre-registered).
// ═══════════════════════════════════════════════════════════════════════════════

import 'server-only';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { encrypt, decrypt, safeDecrypt } from './crypto';
import type {
  ZohoDataCenter,
  ZohoEndpoints,
  ZohoOAuthConfig,
  ZohoOAuthStatePayload,
  ZohoTokenResponse,
  ZohoExchangeResult,
  ZohoRefreshResult,
  ZohoValidTokenResult,
  ZohoConnectionStatus,
  ZohoResolvedOrgUser,
  ZohoOrganization,
} from './types';

// ── OAuth Scope ──────────────────────────────────────────────────────────────

/** The single Zoho Books scope we request (full read/write access). */
export const ZOHO_BOOKS_SCOPE = 'ZohoBooks.fullaccess.all';

// ── Data Center Endpoints ────────────────────────────────────────────────────

/**
 * Per-DC endpoints. `com` is Zoho's US DC; `in` is India; etc.
 * Each DC has its own accounts.* + www.zohoapis.* subdomains.
 */
export const DC_ENDPOINTS: Record<ZohoDataCenter, ZohoEndpoints> = {
  in: {
    authBaseUrl: 'https://accounts.zoho.in',
    tokenUrl: 'https://accounts.zoho.in/oauth/v2/token',
    apiBaseUrl: 'https://www.zohoapis.in/books/v3',
    dataCenter: 'in',
  },
  com: {
    authBaseUrl: 'https://accounts.zoho.com',
    tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
    apiBaseUrl: 'https://www.zohoapis.com/books/v3',
    dataCenter: 'com',
  },
  eu: {
    authBaseUrl: 'https://accounts.zoho.eu',
    tokenUrl: 'https://accounts.zoho.eu/oauth/v2/token',
    apiBaseUrl: 'https://www.zohoapis.eu/books/v3',
    dataCenter: 'eu',
  },
  au: {
    authBaseUrl: 'https://accounts.zoho.com.au',
    tokenUrl: 'https://accounts.zoho.com.au/oauth/v2/token',
    apiBaseUrl: 'https://www.zohoapis.com.au/books/v3',
    dataCenter: 'au',
  },
  jp: {
    authBaseUrl: 'https://accounts.zoho.jp',
    tokenUrl: 'https://accounts.zoho.jp/oauth/v2/token',
    apiBaseUrl: 'https://www.zohoapis.jp/books/v3',
    dataCenter: 'jp',
  },
  ca: {
    authBaseUrl: 'https://accounts.zoho.ca',
    tokenUrl: 'https://accounts.zoho.ca/oauth/v2/token',
    apiBaseUrl: 'https://www.zohoapis.ca/books/v3',
    dataCenter: 'ca',
  },
};

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const REFRESH_BUFFER_MS = 60 * 1000; // refresh 60s before expiry

// ── Data Center Resolution ───────────────────────────────────────────────────

/**
 * Read the configured data center from `ZOHO_DC` env var.
 *
 * Defaults to `in` (India). Unknown values fall back to `in` with a warning
 * — Zoho's most common DC is `in` and silently degrading is safer than
 * throwing (which would break every connect/status call).
 */
export function resolveDataCenter(): ZohoDataCenter {
  const raw = (process.env.ZOHO_DC ?? 'in').trim().toLowerCase();
  if (raw in DC_ENDPOINTS) {
    return raw as ZohoDataCenter;
  }
  console.warn(`[zoho] Unknown ZOHO_DC="${raw}" — falling back to "in".`);
  return 'in';
}

/**
 * Returns the endpoints (authBaseUrl, tokenUrl, apiBaseUrl) for the configured
 * data center. The Books API endpoints also need to be re-derived from the
 * `api_domain` Zoho returns in the token response — that's handled in
 * `getZohoEndpointsForDomain()` below.
 */
export function getZohoEndpoints(): ZohoEndpoints {
  return DC_ENDPOINTS[resolveDataCenter()];
}

// ── Configuration ────────────────────────────────────────────────────────────

export function isZohoConfigured(): boolean {
  return Boolean(
    process.env.ZOHO_CLIENT_ID &&
      process.env.ZOHO_CLIENT_SECRET &&
      process.env.ZOHO_CLIENT_ID.trim().length > 0 &&
      process.env.ZOHO_CLIENT_SECRET.trim().length > 0
  );
}

/**
 * Returns the Zoho OAuth config (clientId, clientSecret, redirectUri, endpoints).
 *
 * `redirectUri` comes from `ZOHO_REDIRECT_URI` env var. Zoho requires the
 * redirect URI to be pre-registered in the Zoho API console — so we do NOT
 * dynamically resolve it from the incoming request (unlike Google).
 *
 * Throws if ZOHO_CLIENT_ID or ZOHO_CLIENT_SECRET is missing.
 */
export function getZohoOAuthConfig(): ZohoOAuthConfig {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const redirectUri = process.env.ZOHO_REDIRECT_URI;
  if (!clientId || !clientSecret) {
    throw new Error(
      'Zoho Books OAuth is not configured. Set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET.'
    );
  }
  if (!redirectUri) {
    throw new Error(
      'Zoho Books OAuth is not configured. Set ZOHO_REDIRECT_URI (must match a Zoho API console entry).'
    );
  }
  return {
    clientId,
    clientSecret,
    redirectUri,
    endpoints: getZohoEndpoints(),
  };
}

// ── HMAC-signed OAuth State ──────────────────────────────────────────────────

let cachedStateKey: Buffer | null = null;

/**
 * Derive the HMAC key for OAuth state signing.
 *
 * Prefers `ZOHO_OAUTH_STATE_SECRET` if set (allows rotating the state key
 * without rotating the OAuth client secret). Falls back to the OAuth client
 * secret so the integration works out-of-the-box without an extra env var.
 */
function getStateKey(): Buffer {
  if (cachedStateKey) return cachedStateKey;
  const secret = process.env.ZOHO_OAUTH_STATE_SECRET ?? process.env.ZOHO_CLIENT_SECRET;
  if (!secret) {
    throw new Error(
      'Cannot derive Zoho OAuth state key — set ZOHO_CLIENT_SECRET (or ZOHO_OAUTH_STATE_SECRET).'
    );
  }
  // Domain-separate from the AES key derivation (different label).
  const key = crypto.createHmac('sha256', 'gstpilot-zoho-state-v1').update(secret).digest();
  cachedStateKey = key;
  return key;
}

/**
 * Build a signed OAuth state string.
 *
 * Format: `<nonce.b64url>.<payload.b64url>.<expiresAt>.<hmac.b64url>`
 *
 *   • `nonce` is a 16-byte cryptographically-random value (also stored inside
 *     the payload — verified on decode so an attacker can't substitute their
 *     own nonce without breaking the HMAC).
 *   • `expiresAt` is a Unix millisecond timestamp; TTL is 10 minutes.
 *   • `hmac` is HMAC-SHA256 of `nonce.payload.expiresAt` using the state key.
 */
export function encodeState(input: ZohoOAuthStatePayload): string {
  const key = getStateKey();
  const nonceBytes = crypto.randomBytes(16);
  const nonce = nonceBytes.toString('base64url');
  const expiresAt = Date.now() + STATE_TTL_MS;

  const payload: ZohoOAuthStatePayload & { n: string } = {
    orgId: input.orgId,
    userId: input.userId,
    userEmail: input.userEmail ?? null,
    returnPath: input.returnPath ?? null,
    redirectUri: input.redirectUri,
    n: nonce,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const expiresStr = String(expiresAt);
  const data = `${nonce}.${payloadB64}.${expiresStr}`;
  const hmac = crypto.createHmac('sha256', key).update(data).digest('base64url');
  return `${data}.${hmac}`;
}

/**
 * Verify + decode an OAuth state string.
 *
 * Returns `null` if:
 *   • The state is malformed (wrong number of parts).
 *   • The HMAC doesn't match (timing-safe comparison).
 *   • The nonce echoed in the payload doesn't match the outer nonce.
 *   • The TTL has expired.
 *
 * Returns the decoded payload otherwise.
 */
export function decodeState(state: string): ZohoOAuthStatePayload | null {
  if (!state || typeof state !== 'string') return null;
  const parts = state.split('.');
  if (parts.length !== 4) return null;
  const [nonceB64, payloadB64, expiresStr, hmacB64] = parts;
  if (!nonceB64 || !payloadB64 || !expiresStr || !hmacB64) return null;

  const key = getStateKey();
  const data = `${nonceB64}.${payloadB64}.${expiresStr}`;
  const expectedHmac = crypto.createHmac('sha256', key).update(data).digest();
  let providedHmac: Buffer;
  try {
    providedHmac = Buffer.from(hmacB64, 'base64url');
  } catch {
    return null;
  }
  if (expectedHmac.length !== providedHmac.length) return null;
  if (!crypto.timingSafeEqual(expectedHmac, providedHmac)) return null;

  // TTL check
  const expiresAt = Number.parseInt(expiresStr, 10);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  // Payload + nonce echo check
  let payload: ZohoOAuthStatePayload & { n?: string };
  try {
    const json = Buffer.from(payloadB64, 'base64url').toString('utf8');
    payload = JSON.parse(json);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;
  if (payload.n !== nonceB64) return null;
  if (!payload.orgId || !payload.userId || !payload.redirectUri) return null;

  return {
    orgId: payload.orgId,
    userId: payload.userId,
    userEmail: payload.userEmail ?? null,
    returnPath: payload.returnPath ?? null,
    redirectUri: payload.redirectUri,
  };
}

// ── Auth URL ─────────────────────────────────────────────────────────────────

/**
 * Build the Zoho consent URL.
 *
 * Zoho uses `prompt=consent` (forces re-consent + guarantees a refresh_token)
 * and `access_type=offline` (returns a refresh_token).
 */
export function buildAuthUrl(state: string, redirectUri: string): string {
  const cfg = getZohoOAuthConfig();
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: ZOHO_BOOKS_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${cfg.endpoints.authBaseUrl}/oauth/v2/auth?${params.toString()}`;
}

// ── Token Exchange ───────────────────────────────────────────────────────────

/**
 * Exchange an authorization code for Zoho tokens.
 *
 * Calls `POST {tokenUrl}` with `grant_type=authorization_code` + the SAME
 * `redirect_uri` that was used to build the auth URL (Zoho's check matches).
 *
 * Returns `{ tokens, error }`:
 *   • Success → `{ tokens: <ZohoTokenResponse>, error: null }`
 *   • Failure → `{ tokens: null, error: '<message>' }`
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<ZohoExchangeResult> {
  const cfg = getZohoOAuthConfig();
  const params = new URLSearchParams({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  try {
    const res = await fetch(cfg.endpoints.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      cache: 'no-store',
    });

    const data = (await res.json().catch(() => ({}))) as ZohoTokenResponse;
    if (!res.ok || !data.access_token) {
      return {
        tokens: null,
        error:
          data.error_description || data.error || `Token exchange failed (HTTP ${res.status}).`,
      };
    }

    return { tokens: data, error: null };
  } catch (e) {
    return {
      tokens: null,
      error: `Network error during token exchange: ${(e as Error).message}`,
    };
  }
}

// ── Token Persistence ────────────────────────────────────────────────────────

interface PersistableTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  api_domain?: string;
  token_type?: string;
  scope?: string;
}

/**
 * Encrypt + persist Zoho tokens for a given (org, user) pair.
 *
 * Uses an `upsert` on the `(organizationId, userId)` unique constraint — if
 * the user re-connects, the existing row is updated in place (preserving the
 * original `connectedAt`).
 *
 * If Zoho didn't return a `refresh_token` (which happens when the user
 * re-consents without revoking first), the existing refresh token is preserved.
 *
 * `zohoOrgId` + `zohoOrgName` are persisted separately via
 * `refreshOrganizationMapping()` after the organizations list is fetched.
 */
export async function storeTokens(
  orgId: string,
  userId: string,
  userEmail: string,
  tokens: PersistableTokens,
  zohoOrgId?: string | null,
  zohoOrgName?: string | null
): Promise<void> {
  const accessTokenEnc = encrypt(tokens.access_token);
  const refreshTokenEnc = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;

  const expiresInSeconds = tokens.expires_in ?? 3600;
  const expiryDate = new Date(Date.now() + expiresInSeconds * 1000);

  const scope = tokens.scope ?? ZOHO_BOOKS_SCOPE;
  const tokenType = tokens.token_type ?? 'Bearer';
  const apiDomain = tokens.api_domain ?? null;
  const dataCenter = resolveDataCenter();

  const update: Record<string, unknown> = {
    userEmail,
    accessToken: accessTokenEnc,
    expiryDate,
    scope,
    tokenType,
    apiDomain,
    dataCenter,
    revokedAt: null, // re-activate any previously revoked connection
  };
  if (refreshTokenEnc !== null) {
    update.refreshToken = refreshTokenEnc;
  }
  if (zohoOrgId !== undefined) {
    update.zohoOrgId = zohoOrgId ?? null;
    update.zohoOrgName = zohoOrgName ?? null;
  }

  await db.zohoBooksToken.upsert({
    where: { organizationId_userId: { organizationId: orgId, userId } },
    create: {
      organizationId: orgId,
      userId,
      userEmail,
      zohoUserId: null,
      zohoOrgId: zohoOrgId ?? null,
      zohoOrgName: zohoOrgName ?? null,
      accessToken: accessTokenEnc,
      refreshToken: refreshTokenEnc ?? '',
      expiryDate,
      scope,
      tokenType,
      apiDomain,
      dataCenter,
      revokedAt: null,
    },
    update,
  });
}

// ── Token Refresh ────────────────────────────────────────────────────────────

/**
 * Refresh a Zoho access token using a stored refresh token.
 *
 * Returns `{ accessToken, expiresIn, apiDomain, error, permanent }`:
 *   • Success → `{ accessToken, expiresIn, apiDomain, error: null, permanent: false }`
 *   • Revoked/expired refresh token (400, 401, 403)
 *     → `{ accessToken: null, error: '<code>', permanent: true }`
 *   • Temporary failure (429, 5xx, network) → `{ error: '...', permanent: false }`
 *
 * Note: Zoho does NOT issue a new refresh token on refresh — the existing one
 * stays valid (until revoked by the user via Zoho's account page).
 */
export async function refreshAccessToken(refreshToken: string): Promise<ZohoRefreshResult> {
  const cfg = getZohoOAuthConfig();
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  try {
    const res = await fetch(cfg.endpoints.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      cache: 'no-store',
    });

    const data = (await res.json().catch(() => ({}))) as ZohoTokenResponse;
    if (!res.ok || !data.access_token) {
      const status = res.status;
      // 400 (invalid_grant), 401, 403 → refresh token has been revoked or expired.
      // 429, 5xx → temporary; retry later.
      const permanent = status === 400 || status === 401 || status === 403;
      const errorCode = data.error || `http_${status}`;
      return {
        accessToken: null,
        expiresIn: null,
        apiDomain: data.api_domain ?? null,
        error: errorCode,
        permanent,
      };
    }

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in ?? 3600,
      apiDomain: data.api_domain ?? null,
      error: null,
      permanent: false,
    };
  } catch (e) {
    // Network errors are NEVER permanent — the user's connection is fine,
    // they're just temporarily unable to reach Zoho.
    return {
      accessToken: null,
      expiresIn: null,
      apiDomain: null,
      error: `network_error: ${(e as Error).message}`,
      permanent: false,
    };
  }
}

// ── Valid Access Token ───────────────────────────────────────────────────────

/**
 * Load a valid access token for the given (org, user), refreshing if needed.
 *
 * Returns `{ accessToken: '...', error: null, permanent: false }` on success.
 *
 * On failure:
 *   • `not_connected` / `revoked` / `decrypt_failed` / `no_refresh_token`
 *     → `permanent: true` (treat as disconnected)
 *   • Refresh returned a temporary error (429/5xx/network)
 *     → `permanent: false` (treat as stale)
 *   • Refresh returned a permanent error (400 / 401 / 403)
 *     → `permanent: true` (treat as disconnected — refresh token is dead)
 */
export async function getValidAccessToken(
  orgId: string,
  userId: string
): Promise<ZohoValidTokenResult> {
  const row = await db.zohoBooksToken.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  });

  if (!row || row.revokedAt) {
    return { accessToken: null, error: 'not_connected', permanent: true };
  }

  const accessToken = safeDecrypt(row.accessToken);
  if (!accessToken) {
    return { accessToken: null, error: 'decrypt_failed', permanent: true };
  }

  const now = Date.now();
  const expiry = row.expiryDate ? row.expiryDate.getTime() : 0;

  // Still valid (with 60s buffer) — return as-is.
  if (expiry - now > REFRESH_BUFFER_MS) {
    return { accessToken, error: null, permanent: false };
  }

  // Need to refresh.
  const refreshToken = safeDecrypt(row.refreshToken);
  if (!refreshToken) {
    return { accessToken: null, error: 'no_refresh_token', permanent: true };
  }

  const refreshResult = await refreshAccessToken(refreshToken);
  if (refreshResult.error || !refreshResult.accessToken) {
    return {
      accessToken: null,
      error: refreshResult.error,
      permanent: refreshResult.permanent,
    };
  }

  const newExpiry = new Date(
    Date.now() + (refreshResult.expiresIn ?? 3600) * 1000
  );

  // Persist the refreshed access token + new expiry + api_domain (in case Zoho
  // moved us to a different DC). We do NOT overwrite the refresh token — Zoho
  // never returns a new refresh token on refresh.
  try {
    await db.zohoBooksToken.update({
      where: { id: row.id },
      data: {
        accessToken: encrypt(refreshResult.accessToken),
        expiryDate: newExpiry,
        ...(refreshResult.apiDomain ? { apiDomain: refreshResult.apiDomain } : {}),
      },
    });
  } catch (e) {
    // Persistence failure is non-fatal — we still return the fresh token for
    // this request. The next request will just refresh again.
    console.warn('[zoho] failed to persist refreshed access token:', (e as Error).message);
  }

  return { accessToken: refreshResult.accessToken, error: null, permanent: false };
}

// ── Connection Status ────────────────────────────────────────────────────────

/**
 * Return the current connection status for the given (org, user).
 *
 *   • `live` — token is valid + (if needed) refresh succeeded.
 *   • `stale` — token row exists but the most recent refresh failed with a
 *     TEMPORARY error (429/5xx/network). The connection itself is still
 *     valid; the UI should retry later.
 *   • `disconnected` — no token row, token revoked, OR refresh failed with
 *     a PERMANENT error (refresh token revoked/expired). The user must
 *     re-connect.
 */
export async function getConnectionStatus(
  orgId: string,
  userId: string
): Promise<ZohoConnectionStatus> {
  const row = await db.zohoBooksToken.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  });

  if (!row || row.revokedAt) {
    return {
      connected: false,
      state: 'disconnected',
      email: row?.userEmail ?? null,
      zohoUserId: row?.zohoUserId ?? null,
      zohoOrgId: row?.zohoOrgId ?? null,
      zohoOrgName: row?.zohoOrgName ?? null,
      dataCenter: row?.dataCenter ?? null,
      apiDomain: row?.apiDomain ?? null,
      connectedAt: row?.connectedAt?.toISOString() ?? null,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
      expiryDate: row?.expiryDate?.toISOString() ?? null,
      scope: row?.scope ?? null,
      error: row?.revokedAt ? 'revoked' : 'not_connected',
      permanent: true,
    };
  }

  const result = await getValidAccessToken(orgId, userId);

  if (result.accessToken) {
    return {
      connected: true,
      state: 'live',
      email: row.userEmail,
      zohoUserId: row.zohoUserId,
      zohoOrgId: row.zohoOrgId,
      zohoOrgName: row.zohoOrgName,
      dataCenter: row.dataCenter,
      apiDomain: row.apiDomain,
      connectedAt: row.connectedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      expiryDate: row.expiryDate?.toISOString() ?? null,
      scope: row.scope,
      error: null,
      permanent: false,
    };
  }

  // No access token — either permanent or temporary failure.
  if (result.permanent) {
    return {
      connected: false,
      state: 'disconnected',
      email: row.userEmail,
      zohoUserId: row.zohoUserId,
      zohoOrgId: row.zohoOrgId,
      zohoOrgName: row.zohoOrgName,
      dataCenter: row.dataCenter,
      apiDomain: row.apiDomain,
      connectedAt: row.connectedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      expiryDate: row.expiryDate?.toISOString() ?? null,
      scope: row.scope,
      error: result.error,
      permanent: true,
    };
  }

  // Temporary failure — still connected, but stale.
  return {
    connected: true,
    state: 'stale',
    email: row.userEmail,
    zohoUserId: row.zohoUserId,
    zohoOrgId: row.zohoOrgId,
    zohoOrgName: row.zohoOrgName,
    dataCenter: row.dataCenter,
    apiDomain: row.apiDomain,
    connectedAt: row.connectedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    expiryDate: row.expiryDate?.toISOString() ?? null,
    scope: row.scope,
    error: result.error,
    permanent: false,
  };
}

// ── Disconnect ────────────────────────────────────────────────────────────────

/**
 * Disconnect the Zoho Books integration for the given (org, user).
 *
 * Zoho does NOT provide a token-revoke endpoint (the access token expires on
 * its own; the refresh token lives until the user manually revokes the app
 * from their Zoho account page → https://accounts.zoho.in/v3/consentapp).
 *
 * So disconnect is a LOCAL operation:
 *   1. Mark the row `revokedAt = now` so subsequent calls return
 *      `state: 'disconnected'` without hitting Zoho.
 *
 * Always returns `{ ok: true }`.
 */
export async function disconnectZoho(
  orgId: string,
  userId: string
): Promise<{ ok: true }> {
  const row = await db.zohoBooksToken.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  });

  if (!row) return { ok: true };

  if (!row.revokedAt) {
    try {
      await db.zohoBooksToken.update({
        where: { id: row.id },
        data: { revokedAt: new Date() },
      });
    } catch (e) {
      console.warn('[zoho] failed to mark token revoked:', (e as Error).message);
    }
  }

  return { ok: true };
}

// ── Header-based org+user resolution ─────────────────────────────────────────
//
// Reads the `x-gstpilot-orgid` + `x-gstpilot-actor` headers stamped by the
// client hook (`useZohoBooks`). Returns nulls if either is missing so
// callers can return a 400 without throwing.

// resolveOrgUserFromHeaders is now canonical in @/lib/auth/session.
// Re-exported for backward compatibility.
// resolveOrgUserFromHeaders is now canonical in @/lib/auth/session.
// Re-exported for backward compatibility with existing imports from this barrel.
export { resolveOrgUserFromHeaders } from '@/lib/auth/session';
export function getApiBaseUrl(apiDomain: string | null | undefined): string {
  if (apiDomain) {
    const trimmed = apiDomain.replace(/\/+$/, '');
    return `${trimmed}/books/v3`;
  }
  return getZohoEndpoints().apiBaseUrl;
}

/**
 * Fetch the user's Zoho Books organizations and update the stored mapping.
 *
 *   1. GET {apiBaseUrl}/organizations with the access token.
 *   2. Pick the default org (or the first one if no default is set).
 *   3. Persist `zohoOrgId` + `zohoOrgName` on the ZohoBooksToken row.
 *
 * Returns the list of all organizations (so the caller can offer a selector)
 * plus the selected one. Best-effort — failures are logged but don't throw
 * (the connection itself succeeded; the user can pick the org later via the
 * `organizations/select` route).
 */
export async function refreshOrganizationMapping(
  orgId: string,
  userId: string,
  accessToken: string
): Promise<{ organizations: ZohoOrganization[]; selected: ZohoOrganization | null }> {
  // Load the row to get the api_domain (Zoho may have moved us to a different DC).
  const row = await db.zohoBooksToken.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  });
  const apiBaseUrl = getApiBaseUrl(row?.apiDomain);

  let organizations: ZohoOrganization[] = [];
  try {
    const url = `${apiBaseUrl}/organizations`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    const data = (await res.json().catch(() => ({}))) as ZohoOrganizationsResponse;
    if (res.ok && Array.isArray(data.organizations)) {
      organizations = data.organizations;
    } else {
      console.warn('[zoho] organizations fetch failed:', data.message ?? res.status);
    }
  } catch (e) {
    console.warn('[zoho] organizations fetch error:', (e as Error).message);
  }

  // Pick the default org (Zoho marks it via `is_default_org`). Fall back to
  // the first one. The user can change this later via the selector.
  const selected =
    organizations.find((o) => o.is_default_org) ?? organizations[0] ?? null;

  if (selected) {
    try {
      await db.zohoBooksToken.update({
        where: { id: row?.id ?? '' },
        data: {
          zohoOrgId: selected.organization_id,
          zohoOrgName: selected.name,
        },
      });
    } catch (e) {
      console.warn('[zoho] failed to persist org mapping:', (e as Error).message);
    }
  }

  return { organizations, selected };
}

// ── Re-exports for convenience ──────────────────────────────────────────────

export { encrypt, decrypt, safeDecrypt };
