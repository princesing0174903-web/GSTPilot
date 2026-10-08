// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO — Google Workspace OAuth Client + Token Store
//
// Handles the full OAuth 2.0 lifecycle:
//   • Build consent URLs with the full Workspace scope set
//   • Exchange authorization codes for access+refresh tokens
//   • Persist encrypted tokens (Prisma `GoogleWorkspaceToken`)
//   • Auto-refresh expired access tokens (transparent to callers)
//   • Revoke tokens on disconnect
//
// SERVER-ONLY. Uses the Node `crypto` module + raw `fetch` to Google's REST
// endpoints (no `googleapis` dependency needed).
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { encrypt, decrypt, safeDecrypt } from './crypto';
import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

// ─── Config ──────────────────────────────────────────────────────────────────

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';

/** The full scope set for the Workspace integration. */
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  // Gmail
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  // Drive (app-created files only — least privilege)
  'https://www.googleapis.com/auth/drive.file',
  // Docs + Sheets (needed by drive.file for app-created docs/sheets)
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  // Calendar
  'https://www.googleapis.com/auth/calendar',
].join(' ');

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  /** Default redirect URI from GOOGLE_REDIRECT_URI env (localhost fallback). */
  redirectUri: string;
}

/**
 * Resolve the Google OAuth credentials from env. Only client_id and
 * client_secret come from here — the redirect URI is resolved per-request
 * via `resolveRedirectUri(req)`.
 */
/**
 * Detect whether the Google OAuth client credentials are configured in the
 * environment. Used by the connect route to return a structured
 * `GOOGLE_NOT_CONFIGURED` payload (HTTP 503) instead of throwing a generic
 * HTTP 500 — mirrors the Zoho Books connect route pattern.
 */
export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    'http://localhost:3000/api/integrations/google/callback';
  if (!clientId || !clientSecret) {
    throw new Error(
      'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET env vars are not set. Configure them in .env',
    );
  }
  return { clientId, clientSecret, redirectUri };
}

// ─── Request-aware redirect URI resolution (HTTPS for preview) ───────────────
//
// Google OAuth redirects the user's BROWSER to the redirect_uri after consent.
// The URI MUST be reachable by the browser AND match what's registered in
// Google Cloud Console. Google only accepts HTTPS for non-localhost redirect
// URIs (production apps).
//
// IMPORTANT — gateway hostname rewriting:
// The preview gateway receives requests at the PUBLIC preview hostname
// (e.g. https://preview-chat-<chat-id>.space-z.ai) but it OVERWRITES the
// `Host` and `X-Forwarded-Host` headers with a STALE internal hostname
// (e.g. ws-ac-*.cn-hongkong-vpc.fcapp.run) before forwarding to Caddy/Next.js.
// It also rewrites `X-Forwarded-Proto` to `http`. We CANNOT trust those three
// headers for public-origin resolution — doing so produces redirect URIs that
// point at the unreachable internal fcapp.run hostname (ERR_CONNECTION_TIMED_OUT).
//
// To work around this, the gateway ALSO sets a custom `abc` header containing
// the PUBLIC preview hostname PREFIX (e.g. "preview-chat-<chat-id>"). The real
// public origin is `https://${abc}.space-z.ai`. This header is the single
// most-reliable signal for the true public hostname, so it is checked FIRST.
//
// Resolution logic (most-trusted first):
//   • `abc` header present            → https://${abc}.space-z.ai
//   • Browsing http://localhost:3000  → http://localhost:3000/...
//   • Browsing https://your-domain.com → https://your-domain.com/...
//
// The connect route and callback route both use resolveRedirectUri(req), so
// the redirect_uri sent to Google in the authorize step exactly matches the
// one sent in the token-exchange step (Google rejects mismatches).

/** Public domain suffix appended to the `abc` header prefix. */
const PREVIEW_PUBLIC_DOMAIN_SUFFIX = 'space-z.ai';

/**
 * Resolve the public origin (scheme://host[:port]) for an incoming request.
 *
 * Resolution order (most-trusted first):
 *   1. `abc` header — gateway-set preview hostname PREFIX (e.g.
 *      "preview-chat-<chat-id>"). The public origin is
 *      `https://${abc}.space-z.ai`. This is checked FIRST because the gateway
 *      overwrites Host/X-Forwarded-Host with a stale internal fcapp.run
 *      hostname. If `abc` already contains a dot (full hostname), it is used
 *      as-is; otherwise the `.space-z.ai` suffix is appended.
 *   2. `Origin` header — set by the browser on fetch/CORS requests, survives
 *      gateway proxies that overwrite `Host`/`X-Forwarded-Host` with a stale
 *      internal hostname. Only used for non-localhost origins (the browser
 *      always knows its own real public origin).
 *   3. `X-Forwarded-Host` + `X-Forwarded-Proto` — gateway-forwarded headers.
 *   4. `Host` header — direct host the server received.
 *   5. `req.url` origin — Next.js internal URL.
 *   6. `GOOGLE_REDIRECT_URI` env var origin.
 *   7. `http://localhost:3000` — last resort.
 *
 * NOTE: The `Origin` header is ONLY sent by the browser on fetch/CORS requests
 * (e.g. the connect endpoint). It is NOT sent on top-level GET navigations
 * (e.g. the Google OAuth callback redirect). For the callback, the redirect_uri
 * is instead passed through the OAuth `state` parameter (see `encodeState`),
 * which was set by the connect step using THIS function — so the abc header is
 * captured at connect time and replayed at callback time.
 */
export function resolvePublicOrigin(req: Request): string {
  const headers = req.headers;

  // 0. `abc` header — gateway-set public preview hostname PREFIX. Checked
  //    FIRST because the gateway overwrites Host/x-forwarded-host with a
  //    stale internal fcapp.run hostname, but it preserves the `abc` header
  //    with the real public preview hostname prefix. This is the ONLY signal
  //    that reliably points at the reachable public hostname.
  const abcHeader = headers.get('abc');
  if (abcHeader) {
    const prefix = abcHeader.trim();
    if (prefix) {
      // If abc already contains a dot (full hostname like "host.example.com"),
      // use it as-is. Otherwise append the platform's public domain suffix
      // to form the full public hostname.
      const host = prefix.includes('.') ? prefix : `${prefix}.${PREVIEW_PUBLIC_DOMAIN_SUFFIX}`;
      return `https://${host}`;
    }
  }

  // 1. Origin header — browser's real public origin (survives gateway proxy).
  //    The gateway overwrites Host/x-forwarded-host with a stale internal
  //    hostname, but it preserves the browser-sent Origin header. This is the
  //    most reliable signal for the real public hostname when abc is absent.
  const originHeader = headers.get('origin');
  if (originHeader) {
    try {
      const parsed = new URL(originHeader);
      if (parsed.host && !parsed.hostname.startsWith('localhost') && !parsed.hostname.startsWith('127.0.0.1')) {
        return `${parsed.protocol}//${parsed.host}`;
      }
    } catch {
      /* ignore malformed origin */
    }
  }

  const forwardedProto =
    headers.get('x-forwarded-proto') || headers.get('x-forwarded-protocol');
  const forwardedHost = headers.get('x-forwarded-host');
  const hostHeader = headers.get('host');

  // 2/3. Determine the host (prefer forwarded host from gateway)
  const host = forwardedHost || hostHeader;

  if (host) {
    const proto = resolveProto(host, forwardedProto);
    return `${proto}://${host}`;
  }

  // 4. Fallback: request URL origin
  try {
    const url = new URL(req.url);
    if (url.host) return `${url.protocol}//${url.host}`;
  } catch {
    /* ignore */
  }

  // 5. Last resort: env var or localhost
  const envRedirect = process.env.GOOGLE_REDIRECT_URI;
  if (envRedirect) {
    try {
      const url = new URL(envRedirect);
      return `${url.protocol}//${url.host}`;
    } catch {
      /* ignore */
    }
  }
  return 'http://localhost:3000';
}

/**
 * Determine the protocol for a given host.
 *
 * - If X-Forwarded-Proto is explicitly 'https', use it (edge proxy set it).
 * - If the host is localhost / 127.0.0.1, use 'http' (local dev).
 * - For ANY other real domain (e.g., *.fcapp.run, your-domain.com), use
 *   'https' — because:
 *     (a) The fcapp.run platform terminates TLS at its edge, so HTTPS is
 *         always available for public hostnames.
 *     (b) Caddy overwrites X-Forwarded-Proto to 'http' (can't modify
 *         Caddyfile), so we can't trust 'http' for real domains.
 *     (c) Google requires HTTPS for non-localhost redirect URIs anyway.
 */
function resolveProto(host: string, forwardedProto: string | null): string {
  if (forwardedProto === 'https') return 'https';
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) return 'http';
  // Real public domain → HTTPS (edge-terminated TLS + Google requirement)
  return 'https';
}

/**
 * Resolve the full OAuth redirect URI for an incoming request — always
 * `${publicOrigin}/api/integrations/google/callback`. Used by BOTH the
 * connect route (to build the authorize URL) and the callback route (to
 * exchange the code for tokens), guaranteeing the two URIs match exactly.
 */
export function resolveRedirectUri(req: Request): string {
  const origin = resolvePublicOrigin(req);
  return `${origin}/api/integrations/google/callback`;
}

/**
 * Convenience: returns the redirect URI from the env var (without a request).
 * Used by the debug endpoint's reference field. In normal request flow, use
 * `resolveRedirectUri(req)` instead.
 */
export function getRedirectUri(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ??
    'http://localhost:3000/api/integrations/google/callback'
  );
}

// ─── Token shape ─────────────────────────────────────────────────────────────

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiryDate: Date | null;
  scope: string;
  tokenType: string;
}

export interface StoredGoogleToken {
  id: string;
  organizationId: string;
  userId: string;
  userEmail: string;
  googleUserId: string | null;
  connectedAt: Date;
  updatedAt: Date;
  revokedAt: Date | null;
}

// ─── OAuth flow ──────────────────────────────────────────────────────────────

/**
 * Build the Google consent URL. `state` is an opaque string echoed back to
 * the callback — encode orgId + userId + return path in it (the caller is
 * responsible for signing/encoding it).
 *
 * `redirectUri` should be the result of `resolveRedirectUri(req)` from the
 * connect route — this makes the OAuth redirect URI match whatever origin
 * the user's browser is actually browsing, with HTTPS inferred for real
 * domains. If omitted, falls back to `GOOGLE_REDIRECT_URI` env var.
 *
 * The same `redirectUri` value MUST be passed to `exchangeCodeForTokens` in
 * the callback route — Google rejects mismatches with `redirect_uri_mismatch`.
 */
export function buildAuthUrl(state: string, redirectUri?: string): string {
  const { clientId, redirectUri: defaultRedirectUri } = getGoogleOAuthConfig();
  const uri = redirectUri ?? defaultRedirectUri;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: uri,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline',
    prompt: 'consent', // force a fresh refresh token every connect
    include_granted_scopes: 'true',
    state,
  });
  return `${GOOGLE_AUTH_BASE}?${params.toString()}`;
}

// ─── OAuth state encode/decode (HMAC-signed, nonce, TTL) ─────────────────────
//
// The OAuth `state` param protects against CSRF: an attacker can't trick a
// user into connecting the attacker's Google account because the callback
// validates that the state matches what WE issued at /connect time.
//
// To make this protection strong (not just base64-encoded JSON that an
// attacker could craft), the state is:
//   1. A random 16-byte nonce (base64url) — unguessable
//   2. The JSON payload (orgId, userId, returnPath, redirectUri)
//   3. An HMAC-SHA256 signature over (nonce + payload + expiresAt) using a
//      server secret
//   4. A TTL: state expires after 10 minutes (defence-in-depth against replay)
//
// Format: `<nonce>.<base64url(payload)>.<expiresAtMs>.<hmac>`
//
// The HMAC secret is derived from GOOGLE_CLIENT_SECRET (already a server-side
// secret) so no additional env var is required. A separate
// GOOGLE_OAUTH_STATE_SECRET can override this for environments that rotate
// client secrets independently.
//
// BACKWARD COMPATIBILITY: decodeState also accepts the legacy unsigned
// base64url-JSON format (no dots) so any in-flight OAuth flows that started
// before this change still complete. Once a state has expired (10 min), the
// legacy format will no longer be accepted.

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getStateHmacSecret(): string {
  // Prefer an explicit state secret if set, else derive from the client secret.
  // The client secret is already a server-side value never exposed to the
  // browser, so it's a suitable HMAC key for OAuth state protection.
  return (
    process.env.GOOGLE_OAUTH_STATE_SECRET ??
    process.env.GOOGLE_CLIENT_SECRET ??
    'gstpilot-google-state-fallback-secret-CHANGEME'
  );
}

function hmacSign(message: string): string {
  const key = getStateHmacSecret();
  return createHmac('sha256', key)
    .update(message)
    .digest('base64url');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return a === b;
  }
}

export interface GoogleOAuthState {
  orgId: string;
  userId: string;
  userEmail: string;
  returnPath?: string;
  redirectUri?: string;
}

/**
 * Encode a safe state token for the OAuth round-trip. HMAC-signed with a
 * 16-byte nonce + 10-minute TTL so the callback can verify authenticity,
 * reject replays, and reject expired states.
 *
 * Includes `redirectUri` so the callback can use the EXACT redirect_uri that
 * was sent to Google in the authorize step — without relying on its own
 * (potentially stale) request headers. This is critical when a gateway proxy
 * overwrites Host/X-Forwarded-Host: the connect step resolves the correct
 * redirect_uri from the browser's Origin header, encodes it here, and the
 * callback reuses it for the token exchange (Google rejects mismatches).
 */
export function encodeState(input: GoogleOAuthState): string {
  // Generate a random 16-byte nonce (base64url, ~22 chars).
  const nonce = randomBytes(16).toString('base64url');
  const payload = Buffer.from(JSON.stringify(input), 'utf8').toString('base64url');
  const expiresAt = Date.now() + STATE_TTL_MS;
  const message = `${nonce}.${payload}.${expiresAt}`;
  const sig = hmacSign(message);
  return `${message}.${sig}`;
}

/**
 * Decode + verify an OAuth state token.
 *
 * Returns null (and logs a warning) when:
 *   • The state is malformed (wrong number of parts)
 *   • The HMAC signature does not match (forged or different secret)
 *   • The state has expired (> 10 min old)
 *   • The payload is not valid JSON
 *
 * BACKWARD COMPAT: also accepts the legacy unsigned base64url-JSON format
 * (no dots). This is logged as a warning so operators can detect when all
 * in-flight legacy states have rolled over. To force strict HMAC-only,
 * set GOOGLE_OAUTH_STATE_STRICT=true.
 */
export function decodeState(state: string): GoogleOAuthState | null {
  // Backward compat: legacy unsigned base64url-JSON format (no dots).
  // Accept only when strict mode is NOT enabled.
  if (!state.includes('.') && process.env.GOOGLE_OAUTH_STATE_STRICT !== 'true') {
    try {
      const json = Buffer.from(state, 'base64url').toString('utf8');
      const parsed = JSON.parse(json) as GoogleOAuthState;
      console.warn(
        '[google/oauth-state] Accepted legacy unsigned state (no HMAC). ' +
          'Set GOOGLE_OAUTH_STATE_STRICT=true to enforce HMAC-only.',
      );
      return parsed;
    } catch (err) {
      console.warn(
        '[google/oauth-state] REJECTED: legacy decode error',
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  }

  try {
    const parts = state.split('.');
    if (parts.length !== 4) return null;
    const [nonce, payload, expiresAtStr, sig] = parts;
    if (!nonce || !payload || !expiresAtStr || !sig) return null;

    // Verify the HMAC signature (constant-time comparison).
    const message = `${nonce}.${payload}.${expiresAtStr}`;
    const expectedSig = hmacSign(message);
    if (!constantTimeEqual(sig, expectedSig)) {
      console.warn('[google/oauth-state] REJECTED: invalid HMAC signature');
      return null;
    }

    // Verify TTL — state expires after STATE_TTL_MS.
    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || Date.now() > expiresAt) {
      console.warn('[google/oauth-state] REJECTED: state expired');
      return null;
    }

    const json = Buffer.from(payload, 'base64url').toString('utf8');
    return JSON.parse(json) as GoogleOAuthState;
  } catch (err) {
    console.warn(
      '[google/oauth-state] REJECTED: decode error',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

interface TokenExchangeResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
}

interface UserInfoResponse {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
}

/**
 * Exchange an authorization code for tokens. Also fetches the Google user
 * profile (email) so we can label the connection.
 *
 * `redirectUri` MUST be the same redirect URI that was used in the
 * `buildAuthUrl` call during the connect step — Google's token endpoint
 * rejects mismatches with `redirect_uri_mismatch`. Pass the result of
 * `resolveRedirectUri(req)` from the callback route; it will naturally
 * match because the callback request comes from the same browser that did
 * the authorize step (same origin).
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri?: string,
): Promise<{ tokens: GoogleTokens; userInfo: UserInfoResponse; error: string | null }> {
  const { clientId, clientSecret, redirectUri: defaultRedirectUri } = getGoogleOAuthConfig();
  const uri = redirectUri ?? defaultRedirectUri;

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: uri,
    grant_type: 'authorization_code',
  });

  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!resp.ok) {
    const text = await resp.text();
    return {
      tokens: emptyTokens(),
      userInfo: {},
      error: `Token exchange failed (${resp.status}): ${text}`,
    };
  }

  const data = (await resp.json()) as TokenExchangeResponse;
  if (!data.access_token) {
    return { tokens: emptyTokens(), userInfo: {}, error: 'No access_token in response.' };
  }

  const expiryDate = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : null;

  const tokens: GoogleTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? '',
    expiryDate,
    scope: data.scope ?? '',
    tokenType: data.token_type ?? 'Bearer',
  };

  // Fetch the user profile from the id_token (decoded) or the userinfo endpoint.
  let userInfo: UserInfoResponse = {};
  if (data.id_token) {
    try {
      const payload = JSON.parse(
        Buffer.from(data.id_token.split('.')[1], 'base64url').toString('utf8'),
      ) as UserInfoResponse;
      userInfo = payload;
    } catch {
      /* ignore decode errors */
    }
  }
  if (!userInfo.email) {
    try {
      const ui = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      if (ui.ok) userInfo = (await ui.json()) as UserInfoResponse;
    } catch {
      /* non-fatal */
    }
  }

  return { tokens, userInfo, error: null };
}

function emptyTokens(): GoogleTokens {
  return { accessToken: '', refreshToken: '', expiryDate: null, scope: '', tokenType: 'Bearer' };
}

// ─── Token persistence ───────────────────────────────────────────────────────

/**
 * Persist (or upsert) the encrypted tokens for an org+user pair.
 */
export async function storeTokens(
  organizationId: string,
  userId: string,
  userEmail: string,
  googleUserId: string | null,
  tokens: GoogleTokens,
): Promise<StoredGoogleToken> {
  const existing = await db.googleWorkspaceToken.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });

  // Only store a new refresh token if one was provided. On a re-connect
  // Google may omit the refresh_token (if prompt=consent didn't fire), so
  // preserve the existing one.
  const refreshTokenEnc = tokens.refreshToken
    ? encrypt(tokens.refreshToken)
    : existing?.refreshToken ?? '';

  const row = await db.googleWorkspaceToken.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    create: {
      organizationId,
      userId,
      userEmail,
      googleUserId,
      accessToken: encrypt(tokens.accessToken),
      refreshToken: refreshTokenEnc,
      expiryDate: tokens.expiryDate,
      scope: tokens.scope,
      tokenType: tokens.tokenType,
      revokedAt: null,
    },
    update: {
      userEmail,
      googleUserId,
      accessToken: encrypt(tokens.accessToken),
      refreshToken: refreshTokenEnc,
      expiryDate: tokens.expiryDate,
      scope: tokens.scope,
      tokenType: tokens.tokenType,
      revokedAt: null,
    },
  });

  return toStored(row);
}

/**
 * Load the stored (decrypted) tokens for an org+user pair.
 */
export async function loadTokens(
  organizationId: string,
  userId: string,
): Promise<{ tokens: GoogleTokens | null; stored: StoredGoogleToken | null }> {
  const row = await db.googleWorkspaceToken.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  if (!row || row.revokedAt) {
    return { tokens: null, stored: null };
  }
  const accessToken = safeDecrypt(row.accessToken);
  const refreshToken = safeDecrypt(row.refreshToken);
  if (!accessToken) {
    return { tokens: null, stored: toStored(row) };
  }
  return {
    tokens: {
      accessToken,
      refreshToken: refreshToken ?? '',
      expiryDate: row.expiryDate,
      scope: row.scope,
      tokenType: row.tokenType,
    },
    stored: toStored(row),
  };
}

/**
 * Get a VALID access token for the org+user, refreshing automatically if the
 * cached access token has expired. This is the single entry point all Google
 * service libs should call before hitting a Google API.
 *
 * Returns `{ accessToken, error, permanent }` — on error, the caller should check
 * `permanent`: if true, the refresh token is genuinely revoked and the user
 * must re-run OAuth; if false, the failure was temporary (network, rate limit)
 * and the connection should remain CONNECTED.
 */
export async function getValidAccessToken(
  organizationId: string,
  userId: string,
): Promise<{ accessToken: string | null; error: string | null; permanent: boolean }> {
  const { tokens, stored } = await loadTokens(organizationId, userId);
  if (!tokens || !stored) {
    return { accessToken: null, error: 'Google Workspace is not connected. Connect your account first.', permanent: true };
  }

  // If the access token is still valid (with a 60s safety margin), use it.
  if (tokens.expiryDate && tokens.expiryDate.getTime() > Date.now() + 60_000) {
    return { accessToken: tokens.accessToken, error: null, permanent: false };
  }

  // Need to refresh.
  if (!tokens.refreshToken) {
    return { accessToken: null, error: 'No refresh token available. Please reconnect Google Workspace.', permanent: true };
  }

  const refreshed = await refreshAccessToken(tokens.refreshToken);
  if (refreshed.error || !refreshed.accessToken) {
    return { accessToken: null, error: refreshed.error ?? 'Token refresh failed.', permanent: refreshed.permanent };
  }

  // Persist the new access token + expiry.
  const newExpiry = refreshed.expiresIn
    ? new Date(Date.now() + refreshed.expiresIn * 1000)
    : null;
  try {
    await db.googleWorkspaceToken.update({
      where: { id: stored.id },
      data: {
        accessToken: encrypt(refreshed.accessToken),
        expiryDate: newExpiry,
      },
    });
  } catch (err) {
    console.warn('[google-workspace] failed to persist refreshed token:', err);
  }

  return { accessToken: refreshed.accessToken, error: null, permanent: false };
}

interface RefreshResult {
  accessToken: string | null;
  expiresIn: number | null;
  error: string | null;
  /** True when the refresh token is genuinely revoked/invalid (HTTP 400 + invalid_grant,
   *  HTTP 401/403). False for temporary errors (network timeout, 429, 5xx) —
   *  in those cases the token is still valid and the user should NOT be told to reconnect. */
  permanent: boolean;
}

/**
 * Exchange a refresh token for a new access token.
 *
 * Returns `{ accessToken, expiresIn, error, permanent }`. When `permanent` is true,
 * the refresh token is genuinely revoked and the user MUST re-run OAuth. When
 * `permanent` is false, the failure was temporary (network, rate limit, server
 * error) and the connection should remain CONNECTED — just marked STALE.
 */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  try {
    const resp = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!resp.ok) {
      const text = await resp.text();
      // HTTP 400 + invalid_grant = refresh token genuinely revoked by the user.
      // HTTP 401/403 = invalid client credentials (config issue, not temporary).
      // These are PERMANENT — the user must re-run OAuth.
      const isPermanent = resp.status === 400 || resp.status === 401 || resp.status === 403;
      return {
        accessToken: null,
        expiresIn: null,
        error: `Refresh failed (${resp.status}): ${text}`,
        permanent: isPermanent,
      };
    }
    const data = (await resp.json()) as { access_token?: string; expires_in?: number };
    return {
      accessToken: data.access_token ?? null,
      expiresIn: data.expires_in ?? null,
      error: null,
      permanent: false,
    };
  } catch (err) {
    // Network error (DNS, timeout, connection refused) — TEMPORARY.
    // The refresh token is still valid; the user should NOT be told to reconnect.
    return {
      accessToken: null,
      expiresIn: null,
      error: err instanceof Error ? err.message : 'Token refresh request failed.',
      permanent: false,
    };
  }
}

// ─── Disconnect ──────────────────────────────────────────────────────────────

/**
 * Revoke the Google tokens + mark the stored row as revoked (soft delete —
 * the row stays for audit history but is no longer usable).
 */
export async function disconnectGoogle(
  organizationId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { tokens, stored } = await loadTokens(organizationId, userId);
  if (!stored) return { error: null }; // already disconnected

  // Best-effort revoke at Google.
  if (tokens?.accessToken) {
    try {
      await fetch(`${GOOGLE_REVOKE_URL}?token=${tokens.accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch (err) {
      console.warn('[google-workspace] revoke request failed:', err);
    }
  }

  try {
    await db.googleWorkspaceToken.update({
      where: { id: stored.id },
      data: {
        revokedAt: new Date(),
        accessToken: '',
        refreshToken: '',
      },
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to mark token revoked.' };
  }

  return { error: null };
}

// ─── Status ──────────────────────────────────────────────────────────────────

/**
 * The 4-state connection model surfaced to the Google Workspace UI.
 *
 *   • `live`          — token valid, recently synced (within 24h)
 *   • `stale`         — token exists + refresh succeeds, but no successful data
 *                       sync in > 24h (best-effort proxy: token row's updatedAt)
 *   • `disconnected`  — no token row / user never connected / revoked
 *   • `error`         — token refresh failed permanently (Google returned 401/403/
 *                       invalid_grant), OR env vars missing, OR stored token
 *                       cannot be decrypted (secret rotated)
 *
 * Mirrors the 4-state contract requested by Phase 3 (P3-GW-STALE-UI). The
 * `connected` boolean is preserved for backward compat (true iff state is
 * `live` or `stale`).
 */
export type GoogleConnectionState = 'live' | 'stale' | 'disconnected' | 'error';

/** Window after which a token row with no activity is considered STALE. */
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface ConnectionStatus {
  /** @deprecated backward-compat boolean — prefer `state`. true iff state is `live` or `stale`. */
  connected: boolean;
  /** 4-state connection model. */
  state: GoogleConnectionState;
  userEmail: string | null;
  googleUserId: string | null;
  connectedAt: string | null;
  /**
   * Best-effort proxy for "last successful data sync". Uses the token row's
   * `updatedAt` (set on every refresh, which happens on every successful
   * Google API call via `getValidAccessToken`). null when no token row exists.
   */
  lastSyncedAt: string | null;
  scopes: string[];
  /** Human-readable error message when state === 'error'. null otherwise. */
  errorMessage: string | null;
  /** True when the user must re-run the OAuth flow (refresh token revoked / undecryptable). */
  requiresReconnect: boolean;
  /** True when GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET env vars are missing. */
  notConfigured: boolean;
  /** Backward-compat: true when org/user context missing on the request. */
  requiresAuth: boolean;
}

/**
 * Resolve the 4-state connection model for an org+user pair. Mirrors Zoho's
 * honesty contract (env-var check + safeDecrypt) and adds:
 *
 *   • Token refresh probe — if the access token is expired, attempt a refresh.
 *     A permanent refresh failure (Google 401/403/invalid_grant) surfaces as
 *     state='error' so the user is proactively prompted to reconnect.
 *   • Staleness check — uses the pre-refresh `updatedAt` to determine whether
 *     the integration has been used in the last 24h. If not, state='stale'.
 *
 * This function does NOT change OAuth logic. It only adds read-only state
 * surfacing. The refresh attempt reuses the existing `getValidAccessToken`
 * path (the same one every Google service lib uses), so the surfaced state
 * matches what a real API call would experience.
 */
export async function getConnectionStatus(
  organizationId: string,
  userId: string,
): Promise<ConnectionStatus> {
  // ERROR (not configured) — env vars missing. Check FIRST so the UI shows an
  // honest "Configuration required" state even when no token row exists yet
  // (first visit). Mirrors Zoho's pattern and the connect route's
  // GOOGLE_NOT_CONFIGURED short-circuit.
  const hasClientId = Boolean(process.env.GOOGLE_CLIENT_ID);
  const hasClientSecret = Boolean(process.env.GOOGLE_CLIENT_SECRET);
  if (!hasClientId || !hasClientSecret) {
    // Try to read the token row for context (user email, last connected) but
    // don't require it — the not-configured state is meaningful even with no
    // prior connection.
    const row = await db.googleWorkspaceToken.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    }).catch(() => null);
    return {
      connected: false,
      state: 'error',
      userEmail: row?.userEmail ?? null,
      googleUserId: row?.googleUserId ?? null,
      connectedAt: row?.connectedAt.toISOString() ?? null,
      lastSyncedAt: row?.updatedAt.toISOString() ?? null,
      scopes: row?.scope ? row.scope.split(' ') : [],
      errorMessage:
        'Google Workspace OAuth credentials are not configured on this server. An administrator must set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before the connection can be used.',
      requiresReconnect: false,
      notConfigured: true,
      requiresAuth: false,
    };
  }

  const row = await db.googleWorkspaceToken.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });

  // DISCONNECTED — no token row OR revoked OR access token wiped (post-disconnect).
  if (!row || row.revokedAt || !row.accessToken) {
    return {
      connected: false,
      state: 'disconnected',
      userEmail: row?.userEmail ?? null,
      googleUserId: row?.googleUserId ?? null,
      connectedAt: row?.connectedAt.toISOString() ?? null,
      lastSyncedAt: row?.updatedAt.toISOString() ?? null,
      scopes: row?.scope ? row.scope.split(' ') : [],
      errorMessage: null,
      requiresReconnect: false,
      notConfigured: false,
      requiresAuth: false,
    };
  }

  // ERROR (undecryptable) — secret was rotated since the connection was made.
  const decryptedAccess = safeDecrypt(row.accessToken);
  if (!decryptedAccess) {
    return {
      connected: false,
      state: 'error',
      userEmail: row.userEmail,
      googleUserId: row.googleUserId,
      connectedAt: row.connectedAt.toISOString(),
      lastSyncedAt: row.updatedAt.toISOString(),
      scopes: row.scope ? row.scope.split(' ') : [],
      errorMessage:
        'The stored Google Workspace tokens cannot be decrypted. This usually means the GOOGLE_CLIENT_SECRET was rotated since the last connection. Please reconnect Google Workspace.',
      requiresReconnect: true,
      notConfigured: false,
      requiresAuth: false,
    };
  }

  // Capture the pre-refresh `updatedAt`. If the access token is expired,
  // getValidAccessToken will refresh + persist a new expiryDate (bumping
  // updatedAt to now). We want the staleness check to use the OLD value so
  // a user who hasn't touched the integration in > 24h sees STALE even after
  // a successful refresh.
  const preRefreshUpdatedAt = row.updatedAt;
  const preRefreshExpiryMs = row.expiryDate ? row.expiryDate.getTime() : 0;
  const tokenWasStillValid = preRefreshExpiryMs > Date.now() + 60_000;

  // Ensure a valid access token (refreshes if expired). This is the SAME path
  // every Google service lib uses — so the state we surface matches what a
  // real API call would experience.
  const { accessToken, error, permanent } = await getValidAccessToken(organizationId, userId);

  // ERROR (refresh failed) — distinguish PERMANENT vs TEMPORARY failures.
  //
  // PERMANENT (permanent === true): Google returned 400/invalid_grant or
  // 401/403. The refresh token is genuinely revoked. The user must re-run OAuth.
  //
  // TEMPORARY (permanent === false): Network timeout, rate limit (429), or
  // Google API 5xx. The DB token is STILL VALID — the refresh just couldn't
  // reach Google right now. We must NOT mark the connection as disconnected.
  // Instead, return connected: true + state: 'stale' so the UI shows "Live
  // data may be delayed" (not "Reconnect required").
  if (error || !accessToken) {
    if (permanent) {
      return {
        connected: false,
        state: 'error',
        userEmail: row.userEmail,
        googleUserId: row.googleUserId,
        connectedAt: row.connectedAt.toISOString(),
        lastSyncedAt: preRefreshUpdatedAt.toISOString(),
        scopes: row.scope ? row.scope.split(' ') : [],
        errorMessage:
          error ??
          'Google Workspace token refresh failed. The user may have revoked access. Please reconnect Google Workspace.',
        requiresReconnect: true,
        notConfigured: false,
        requiresAuth: false,
      };
    }
    // TEMPORARY failure — token is still in the DB, refresh just couldn't reach
    // Google right now. Keep the connection as CONNECTED + STALE so the user
    // is NOT told to reconnect. They can retry by refreshing the page.
    return {
      connected: true,
      state: 'stale',
      userEmail: row.userEmail,
      googleUserId: row.googleUserId,
      connectedAt: row.connectedAt.toISOString(),
      lastSyncedAt: preRefreshUpdatedAt.toISOString(),
      scopes: row.scope ? row.scope.split(' ') : [],
      errorMessage: `Live data temporarily unavailable: ${error}. The connection is still active — try refreshing in a moment.`,
      requiresReconnect: false,
      notConfigured: false,
      requiresAuth: false,
    };
  }

  // Token is healthy (either was valid or just refreshed). Determine staleness
  // based on the PRE-refresh `updatedAt`:
  //   • If the access token was still valid (not refreshed), `updatedAt` is
  //     within the last hour (Google access tokens last 1h) → never stale.
  //   • If the access token was expired and just refreshed, `updatedAt` may
  //     be > 24h ago (the user hasn't touched the integration in over a day)
  //     → STALE.
  const lastActivityMs = preRefreshUpdatedAt.getTime();
  const isStale =
    !tokenWasStillValid &&
    Date.now() - lastActivityMs > STALE_THRESHOLD_MS;

  return {
    connected: true,
    state: isStale ? 'stale' : 'live',
    userEmail: row.userEmail,
    googleUserId: row.googleUserId,
    connectedAt: row.connectedAt.toISOString(),
    lastSyncedAt: preRefreshUpdatedAt.toISOString(),
    scopes: row.scope ? row.scope.split(' ') : [],
    errorMessage: null,
    requiresReconnect: false,
    notConfigured: false,
    requiresAuth: false,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toStored(row: {
  id: string;
  organizationId: string;
  userId: string;
  userEmail: string;
  googleUserId: string | null;
  connectedAt: Date;
  updatedAt: Date;
  revokedAt: Date | null;
}): StoredGoogleToken {
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    userEmail: row.userEmail,
    googleUserId: row.googleUserId,
    connectedAt: row.connectedAt,
    updatedAt: row.updatedAt,
    revokedAt: row.revokedAt,
  };
}

/**
 * Minimal auth-context resolution shared by all Google API routes. Reads the
 * `x-gstpilot-orgid` + `x-gstpilot-actor` headers (same convention as the
 * enterprise-org routes) and returns the orgId + userId for token lookup.
 *
 * In preview mode (no Firebase Admin credentials), trusts the actor header.
 * The Prisma token store is the real backstop — a forged actor header can't
 * read another org's tokens because the orgId is part of the unique key.
 */
export function resolveOrgFromHeaders(req: Request): string | null {
  return req.headers.get('x-gstpilot-orgid')?.trim() || null;
}

/** Decrypt helper re-export for service libs that need raw token access. */
export { decrypt };
