// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Google Workspace OAuth Helper (server-only)
// ═══════════════════════════════════════════════════════════════════════════════
// This module is the SINGLE entry point for all server-side Google Workspace
// OAuth concerns:
//
//   • Scope definition (Gmail, Drive, Calendar, Docs/Sheets, OIDC).
//   • OAuth config validation (isGoogleConfigured / getGoogleOAuthConfig).
//   • Redirect-URI resolution (7-step fallback, env var first, then request
//     origin → abc preview header → Origin → X-Forwarded-Host → Host → req.url
//     → localhost:3000 last resort).
//   • HMAC-signed OAuth state (16-byte nonce, 10-minute TTL, timingSafeEqual).
//   • Authorization-code exchange + userinfo fetch.
//   • Token persistence (AES-256-GCM via crypto.ts, upsert on org+user).
//   • Token refresh with `permanent` flag distinguishing revoked tokens
//     (400/401/403) from temporary failures (429/5xx/network).
//   • Connection status (live / stale / disconnected).
//   • Disconnect (revoke at Google + mark revoked locally).
//   • Header-based org+user resolution (mirrors `useOrgUserHeaders` client-side).
//
// SECURITY:
//   • All credentials stay server-side (process.env only — never returned).
//   • Access + refresh tokens are AES-256-GCM encrypted at rest.
//   • OAuth state is HMAC-signed with a 10-minute TTL + 16-byte nonce + nonce
//     echoed in payload (defense against replay under same key).
//   • HMAC comparison uses `crypto.timingSafeEqual` (constant-time).
//   • Tenant isolation: every DB query is scoped by (organizationId, userId).
//   • Google access tokens NEVER returned to the frontend — only the proxied
//     API responses (Gmail messages, Drive files, Calendar events).
// ═══════════════════════════════════════════════════════════════════════════════

import 'server-only';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { encrypt, decrypt, safeDecrypt } from './crypto';

// ── OAuth Scopes ────────────────────────────────────────────────────────────
//
// We request the full set of scopes up-front so the user only consents once.
// `prompt: 'consent'` + `access_type: 'offline'` in the auth URL guarantees
// Google returns a refresh_token on every connect (not just the first time).

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/calendar',
] as const;

const CALLBACK_PATH = '/api/integrations/google/callback';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const REFRESH_BUFFER_MS = 60 * 1000; // refresh 60s before expiry

// ── Configuration ────────────────────────────────────────────────────────────

export function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_CLIENT_ID.trim().length > 0 &&
      process.env.GOOGLE_CLIENT_SECRET.trim().length > 0
  );
}

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Returns the static OAuth config (clientId, clientSecret, redirectUri).
 *
 * The `redirectUri` here is the FALLBACK (env var or localhost) — for the
 * actual consent flow, always resolve the redirect URI from the incoming
 * request via `resolveRedirectUri(req)` and pass it to `buildAuthUrl` /
 * `exchangeCodeForTokens` so Google's check matches.
 *
 * Throws if GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing.
 */
export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      'Google Workspace OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.'
    );
  }
  return {
    clientId,
    clientSecret,
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? '',
  };
}

// ── Redirect URI Resolution (7-step fallback) ────────────────────────────────
//
// Order:
//   1. GOOGLE_REDIRECT_URI env var (if set)
//   2. `abc` header — preview-gateway marker (host name)
//   3. `Origin` header
//   4. `X-Forwarded-Host` (+ `X-Forwarded-Proto`)
//   5. `Host` header (with proto inference from localhost)
//   6. `req.url` (origin portion)
//   7. http://localhost:3000 (last resort)

export function resolveRedirectUri(req: Request): string {
  // 1. Env var
  const envUri = process.env.GOOGLE_REDIRECT_URI;
  if (envUri && envUri.trim().length > 0) return envUri.trim();

  // 2. `abc` header (preview gateway marker)
  const abc = req.headers.get('abc');
  if (abc && abc.trim().length > 0) {
    return `https://${abc.trim()}${CALLBACK_PATH}`;
  }

  // 3. Origin
  const origin = req.headers.get('origin');
  if (origin && origin.trim().length > 0) {
    return `${origin.trim()}${CALLBACK_PATH}`;
  }

  // 4. X-Forwarded-Host (+ X-Forwarded-Proto)
  const fwdHost = req.headers.get('x-forwarded-host');
  if (fwdHost && fwdHost.trim().length > 0) {
    const proto = (req.headers.get('x-forwarded-proto') ?? 'https').split(',')[0]?.trim() || 'https';
    return `${proto}://${fwdHost.trim()}${CALLBACK_PATH}`;
  }

  // 5. Host header
  const host = req.headers.get('host');
  if (host && host.trim().length > 0) {
    const proto = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
    return `${proto}://${host.trim()}${CALLBACK_PATH}`;
  }

  // 6. req.url origin
  try {
    const u = new URL(req.url);
    if (u.origin && u.origin !== 'null') {
      return `${u.origin}${CALLBACK_PATH}`;
    }
  } catch {
    /* fall through to localhost */
  }

  // 7. localhost fallback
  return `http://localhost:3000${CALLBACK_PATH}`;
}

// ── HMAC-signed OAuth State ──────────────────────────────────────────────────

export interface GoogleOAuthStatePayload {
  orgId: string;
  userId: string;
  userEmail: string | null;
  returnPath: string | null;
  redirectUri: string;
}

let cachedStateKey: Buffer | null = null;

/**
 * Derive the HMAC key for OAuth state signing.
 *
 * Prefers `GOOGLE_OAUTH_STATE_SECRET` if set (allows rotating the state key
 * without rotating the OAuth client secret). Falls back to the OAuth client
 * secret so the integration works out-of-the-box without an extra env var.
 */
function getStateKey(): Buffer {
  if (cachedStateKey) return cachedStateKey;
  const secret = process.env.GOOGLE_OAUTH_STATE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) {
    throw new Error(
      'Cannot derive Google OAuth state key — set GOOGLE_CLIENT_SECRET (or GOOGLE_OAUTH_STATE_SECRET).'
    );
  }
  // Domain-separate from the AES key derivation (different label).
  const key = crypto.createHmac('sha256', 'gstpilot-google-state-v1').update(secret).digest();
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
export function encodeState(input: GoogleOAuthStatePayload): string {
  const key = getStateKey();
  const nonceBytes = crypto.randomBytes(16);
  const nonce = nonceBytes.toString('base64url');
  const expiresAt = Date.now() + STATE_TTL_MS;

  const payload: GoogleOAuthStatePayload & { n: string } = {
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
export function decodeState(state: string): GoogleOAuthStatePayload | null {
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
  let payload: GoogleOAuthStatePayload & { n?: string };
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

export function buildAuthUrl(state: string, redirectUri: string): string {
  const cfg = getGoogleOAuthConfig();
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ── Token Exchange ───────────────────────────────────────────────────────────

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  expiry_date?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfo {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  locale?: string;
}

export interface ExchangeResult {
  tokens: GoogleTokenResponse | null;
  userInfo: GoogleUserInfo | null;
  error: string | null;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<ExchangeResult> {
  const cfg = getGoogleOAuthConfig();
  const params = new URLSearchParams({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      cache: 'no-store',
    });

    const data = (await res.json().catch(() => ({}))) as GoogleTokenResponse;
    if (!res.ok || !data.access_token) {
      return {
        tokens: null,
        userInfo: null,
        error: data.error_description || data.error || `Token exchange failed (HTTP ${res.status}).`,
      };
    }

    // Fetch userinfo with the fresh access token.
    let userInfo: GoogleUserInfo | null = null;
    try {
      const uRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${data.access_token}` },
        cache: 'no-store',
      });
      if (uRes.ok) userInfo = (await uRes.json().catch(() => null)) as GoogleUserInfo | null;
    } catch {
      /* userinfo is best-effort — token exchange still succeeded */
    }

    return { tokens: data, userInfo, error: null };
  } catch (e) {
    return {
      tokens: null,
      userInfo: null,
      error: `Network error during token exchange: ${(e as Error).message}`,
    };
  }
}

// ── Token Persistence ────────────────────────────────────────────────────────

interface PersistableTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expiry_date?: number;
  scope?: string;
  token_type?: string;
}

/**
 * Encrypt + persist Google tokens for a given (org, user) pair.
 *
 * Uses an `upsert` on the `(organizationId, userId)` unique constraint — if
 * the user re-connects, the existing row is updated in place (preserving the
 * original `connectedAt`).
 *
 * If Google didn't return a `refresh_token` (which happens when the user
 * re-consents without revoking first), the existing refresh token is preserved.
 */
export async function storeTokens(
  orgId: string,
  userId: string,
  userEmail: string,
  googleUserId: string | null,
  tokens: PersistableTokens
): Promise<void> {
  const accessTokenEnc = encrypt(tokens.access_token);
  const refreshTokenEnc = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;

  const expiryDate =
    tokens.expiry_date != null
      ? new Date(tokens.expiry_date)
      : tokens.expires_in != null
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null;

  const scope = tokens.scope ?? GOOGLE_SCOPES.join(' ');
  const tokenType = tokens.token_type ?? 'Bearer';

  const update: Record<string, unknown> = {
    userEmail,
    googleUserId: googleUserId ?? null,
    accessToken: accessTokenEnc,
    expiryDate,
    scope,
    tokenType,
    revokedAt: null, // re-activate any previously revoked connection
  };
  if (refreshTokenEnc !== null) {
    update.refreshToken = refreshTokenEnc;
  }

  await db.googleWorkspaceToken.upsert({
    where: { organizationId_userId: { organizationId: orgId, userId } },
    create: {
      organizationId: orgId,
      userId,
      userEmail,
      googleUserId: googleUserId ?? null,
      accessToken: accessTokenEnc,
      refreshToken: refreshTokenEnc ?? '',
      expiryDate,
      scope,
      tokenType,
      revokedAt: null,
    },
    update,
  });
}

// ── Token Refresh ────────────────────────────────────────────────────────────

export interface RefreshResult {
  accessToken: string | null;
  expiresIn: number | null;
  error: string | null;
  /** True if the refresh token has been revoked / expired (400/401/403).
   *  False for temporary failures (429/5xx/network) — caller should treat
   *  the connection as `stale` rather than `disconnected`. */
  permanent: boolean;
}

/**
 * Refresh a Google access token using a stored refresh token.
 *
 * Returns `{ accessToken, expiresIn, error, permanent }`:
 *   • Success → `{ accessToken, expiresIn, error: null, permanent: false }`
 *   • Revoked/expired refresh token (400 invalid_grant, 401, 403)
 *     → `{ accessToken: null, error: '<code>', permanent: true }`
 *   • Temporary failure (429, 5xx, network) → `{ error: '...', permanent: false }`
 */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
  const cfg = getGoogleOAuthConfig();
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      cache: 'no-store',
    });

    const data = (await res.json().catch(() => ({}))) as GoogleTokenResponse;
    if (!res.ok || !data.access_token) {
      const status = res.status;
      // 400 invalid_grant, 401, 403 → refresh token has been revoked or expired.
      // 429, 5xx → temporary; retry later.
      const permanent = status === 400 || status === 401 || status === 403;
      const errorCode = data.error || `http_${status}`;
      return {
        accessToken: null,
        expiresIn: null,
        error: errorCode,
        permanent,
      };
    }

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in ?? 3600,
      error: null,
      permanent: false,
    };
  } catch (e) {
    // Network errors are NEVER permanent — the user's connection is fine,
    // they're just temporarily unable to reach Google.
    return {
      accessToken: null,
      expiresIn: null,
      error: `network_error: ${(e as Error).message}`,
      permanent: false,
    };
  }
}

// ── Valid Access Token ───────────────────────────────────────────────────────

export interface ValidTokenResult {
  accessToken: string | null;
  error: string | null;
  /** True if the failure is permanent (revoked, decryption failed, no refresh).
   *  False for temporary failures (rate limit, network). */
  permanent: boolean;
}

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
 *   • Refresh returned a permanent error (400 invalid_grant / 401 / 403)
 *     → `permanent: true` (treat as disconnected — refresh token is dead)
 */
export async function getValidAccessToken(
  orgId: string,
  userId: string
): Promise<ValidTokenResult> {
  const row = await db.googleWorkspaceToken.findUnique({
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

  // Persist the refreshed access token + new expiry. We do NOT overwrite the
  // refresh token — Google only returns a refresh_token on the initial
  // authorization-code exchange, so we must preserve the one we have.
  try {
    await db.googleWorkspaceToken.update({
      where: { id: row.id },
      data: {
        accessToken: encrypt(refreshResult.accessToken),
        expiryDate: newExpiry,
      },
    });
  } catch (e) {
    // Persistence failure is non-fatal — we still return the fresh token for
    // this request. The next request will just refresh again.
    console.warn('[google] failed to persist refreshed access token:', (e as Error).message);
  }

  return { accessToken: refreshResult.accessToken, error: null, permanent: false };
}

// ── Connection Status ────────────────────────────────────────────────────────

export interface GoogleConnectionStatus {
  connected: boolean;
  state: 'live' | 'stale' | 'disconnected';
  email: string | null;
  googleUserId: string | null;
  connectedAt: string | null;
  updatedAt: string | null;
  expiryDate: string | null;
  scope: string | null;
  /** Populated when state is `stale` or `disconnected`. */
  error: string | null;
  /** True if the failure was permanent (treat as disconnected). */
  permanent: boolean;
}

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
): Promise<GoogleConnectionStatus> {
  const row = await db.googleWorkspaceToken.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  });

  if (!row || row.revokedAt) {
    return {
      connected: false,
      state: 'disconnected',
      email: row?.userEmail ?? null,
      googleUserId: row?.googleUserId ?? null,
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
      googleUserId: row.googleUserId,
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
      googleUserId: row.googleUserId,
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
    googleUserId: row.googleUserId,
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
 * Disconnect the Google Workspace integration for the given (org, user).
 *
 *   1. Best-effort revoke the token at Google (so the access_token + any
 *      refresh_token stops working for this app).
 *   2. Mark the row `revokedAt = now` so subsequent calls return
 *      `state: 'disconnected'` without hitting Google.
 *
 * Always returns `{ ok: true }` even if Google's revoke endpoint fails —
 * the local revoke is authoritative for the user's experience.
 */
export async function disconnectGoogle(
  orgId: string,
  userId: string
): Promise<{ ok: true }> {
  const row = await db.googleWorkspaceToken.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  });

  if (!row) return { ok: true };

  if (!row.revokedAt) {
    // Prefer revoking the refresh token (longer-lived). Fall back to the
    // access token if no refresh token was stored (rare).
    const tokenToRevoke =
      safeDecrypt(row.refreshToken) || safeDecrypt(row.accessToken);
    if (tokenToRevoke) {
      try {
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenToRevoke)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            cache: 'no-store',
          }
        );
      } catch (e) {
        // Non-fatal — we still mark the token revoked locally. Google will
        // eventually expire the token on its own.
        console.warn('[google] revoke call failed:', (e as Error).message);
      }
    }
  }

  try {
    await db.googleWorkspaceToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });
  } catch (e) {
    console.warn('[google] failed to mark token revoked:', (e as Error).message);
  }

  return { ok: true };
}

// ── Header-based org+user resolution ─────────────────────────────────────────
//
// Reads the `x-gstpilot-orgid` + `x-gstpilot-actor` headers stamped by the
// client hook (`useGoogleWorkspace`). Returns nulls if either is missing so
// callers can return a 400 without throwing.

export interface ResolvedOrgUser {
  orgId: string;
  userId: string;
  userEmail: string | null;
  actorName: string | null;
  role: string | null;
}

// resolveOrgUserFromHeaders is now canonical in @/lib/auth/session.
// Re-exported for backward compatibility.
export { resolveOrgUserFromHeaders } from '@/lib/auth/session';
  const orgId = req.headers.get('x-gstpilot-orgid')?.trim() || null;
  const actorRaw = req.headers.get('x-gstpilot-actor');
  let userId: string | null = null;
  let userEmail: string | null = null;
  let actorName: string | null = null;
  let role: string | null = null;
  if (actorRaw) {
    try {
      const parsed = JSON.parse(actorRaw) as {
        uid?: string;
        email?: string;
        name?: string;
        role?: string;
      };
      if (parsed.uid && typeof parsed.uid === 'string') userId = parsed.uid;
      if (parsed.email) userEmail = parsed.email;
      if (parsed.name) actorName = parsed.name;
      if (parsed.role) role = parsed.role;
    } catch {
      /* malformed header — leave nulls */
    }
  }
  return { orgId, userId, userEmail, actorName, role };
}

// ── Re-exports for convenience ────────────────────────────────────────────────

export { encrypt, decrypt, safeDecrypt };
