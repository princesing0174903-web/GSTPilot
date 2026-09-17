// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Zoho Books OAuth 2.0 Client + Token Store
//
// Handles the full OAuth 2.0 Authorization Code Flow lifecycle:
//   • Resolve Zoho endpoints from the ZOHO_DC env var (in / com / eu / au / jp / ca)
//   • Build the consent-screen URL with the ZohoBooks.fullaccess.all scope
//   • Exchange authorization codes for access + refresh tokens
//   • Persist AES-256-GCM-encrypted tokens to Prisma `ZohoBooksToken`
//   • Auto-refresh expired access tokens (transparent to callers)
//   • Revoke tokens on disconnect
//   • Map the user's default Zoho Books organization (multi-tenant)
//
// SERVER-ONLY. Uses Node `crypto` + raw `fetch` to Zoho's REST endpoints —
// no third-party OAuth library needed.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { encrypt, decrypt, safeDecrypt } from './crypto';
import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto';
import {
  ZOHO_BOOKS_SCOPE,
  ZOHO_BOOKS_SCOPE_AREAS,
  type ZohoDataCenter,
  type ZohoEndpoints,
  type ZohoOAuthConfig,
  type ZohoOAuthState,
  type ZohoTokenExchangeResponse,
  type ZohoTokenExchangeResult,
  type ZohoTokens,
  type ZohoRefreshResult,
  type ZohoUserInfo,
  type StoredZohoToken,
  type ZohoConnectionStatus,
  type ResolvedOrgUser,
} from './types';

// ─── Data-center endpoint map ────────────────────────────────────────────────

const DC_ENDPOINTS: Record<ZohoDataCenter, ZohoEndpoints> = {
  in: { authBaseUrl: 'https://accounts.zoho.in/oauth/v2/auth', tokenUrl: 'https://accounts.zoho.in/oauth/v2/token', apiBaseUrl: 'https://www.zohoapis.in/books/v3', dc: 'in' },
  com: { authBaseUrl: 'https://accounts.zoho.com/oauth/v2/auth', tokenUrl: 'https://accounts.zoho.com/oauth/v2/token', apiBaseUrl: 'https://www.zohoapis.com/books/v3', dc: 'com' },
  eu: { authBaseUrl: 'https://accounts.zoho.eu/oauth/v2/auth', tokenUrl: 'https://accounts.zoho.eu/oauth/v2/token', apiBaseUrl: 'https://www.zohoapis.eu/books/v3', dc: 'eu' },
  au: { authBaseUrl: 'https://accounts.zoho.com.au/oauth/v2/auth', tokenUrl: 'https://accounts.zoho.com.au/oauth/v2/token', apiBaseUrl: 'https://www.zohoapis.com.au/books/v3', dc: 'au' },
  jp: { authBaseUrl: 'https://accounts.zoho.jp/oauth/v2/auth', tokenUrl: 'https://accounts.zoho.jp/oauth/v2/token', apiBaseUrl: 'https://www.zohoapis.jp/books/v3', dc: 'jp' },
  ca: { authBaseUrl: 'https://accounts.zoho.ca/oauth/v2/auth', tokenUrl: 'https://accounts.zoho.ca/oauth/v2/token', apiBaseUrl: 'https://www.zohoapis.ca/books/v3', dc: 'ca' },
};

/** Resolve the Zoho data center from the ZOHO_DC env var (default: in). */
export function resolveDataCenter(): ZohoDataCenter {
  const raw = (process.env.ZOHO_DC ?? 'in').toLowerCase().trim();
  if (raw in DC_ENDPOINTS) return raw as ZohoDataCenter;
  console.warn(`[zoho-books] Unknown ZOHO_DC="${raw}", falling back to "in".`);
  return 'in';
}

/** Resolve endpoints for the configured data center. */
export function getZohoEndpoints(): ZohoEndpoints {
  return DC_ENDPOINTS[resolveDataCenter()];
}

// ─── Config ──────────────────────────────────────────────────────────────────

/**
 * Resolve the Zoho OAuth credentials + endpoints from env. The redirect URI is
 * resolved per-request via `resolveRedirectUri(req)` for gateway-awareness, but
 * the env var `ZOHO_REDIRECT_URI` is used as the default / fallback.
 */
export function getZohoOAuthConfig(): ZohoOAuthConfig {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const redirectUri =
    process.env.ZOHO_REDIRECT_URI ??
    'http://localhost:3000/api/integrations/zoho/callback';
  if (!clientId || !clientSecret) {
    throw new Error(
      'ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET env vars are not set. Configure them in .env.local',
    );
  }
  return { clientId, clientSecret, redirectUri, endpoints: getZohoEndpoints() };
}

// ─── Request-aware redirect URI resolution (gateway/preview-aware) ───────────
//
// Mirrors the Google Workspace implementation: the gateway rewrites the
// public hostname into an `abc` header on preview deploys, and the OAuth
// redirect URI must match exactly what's registered in the Zoho API console.

const PREVIEW_PUBLIC_DOMAIN_SUFFIX = 'space-z.ai';

/** Resolve the public origin (scheme://host[:port]) for an incoming request. */
export function resolvePublicOrigin(req: Request): string {
  const headers = req.headers;

  const abcHeader = headers.get('abc');
  if (abcHeader) {
    const prefix = abcHeader.trim();
    if (prefix) {
      const host = prefix.includes('.') ? prefix : `${prefix}.${PREVIEW_PUBLIC_DOMAIN_SUFFIX}`;
      return `https://${host}`;
    }
  }

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

  const forwardedProto = headers.get('x-forwarded-proto') || headers.get('x-forwarded-protocol');
  const forwardedHost = headers.get('x-forwarded-host');
  const hostHeader = headers.get('host');
  const host = forwardedHost || hostHeader;

  if (host) {
    const proto = resolveProto(host, forwardedProto);
    return `${proto}://${host}`;
  }

  try {
    const url = new URL(req.url);
    if (url.host) return `${url.protocol}//${url.host}`;
  } catch {
    /* ignore */
  }

  const envRedirect = process.env.ZOHO_REDIRECT_URI;
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

function resolveProto(host: string, forwardedProto: string | null): string {
  if (forwardedProto === 'https') return 'https';
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) return 'http';
  return 'https';
}

/**
 * Classify the incoming request environment for OAuth redirect URI selection.
 *   - "local"      → request originated from localhost / 127.0.0.1 (dev server)
 *   - "preview"    → request came through the z.ai gateway (abc header or
 *                    x-forwarded-host ending in `.space-z.ai` or any public host)
 *   - "production" → request came from a non-localhost public hostname
 */
export type ZohoRedirectEnvironment = 'local' | 'preview' | 'production';

const CALLBACK_PATH = '/api/integrations/zoho/callback';

/** Returns true when host refers to the local dev server. */
function isLocalhostHost(host: string | null): boolean {
  if (!host) return false;
  const h = host.toLowerCase();
  return (
    h.startsWith('localhost') ||
    h.startsWith('127.0.0.1') ||
    h.startsWith('0.0.0.0') ||
    h.startsWith('[::1]')
  );
}

/** Classify the request environment by inspecting gateway / host headers. */
export function classifyRequestEnvironment(req: Request): ZohoRedirectEnvironment {
  const headers = req.headers;
  // The z.ai gateway stamps the public preview hostname into the `abc` header.
  if (headers.get('abc')) return 'preview';
  // x-forwarded-host takes precedence over host when behind a reverse proxy.
  const fwdHost = headers.get('x-forwarded-host');
  if (fwdHost && !isLocalhostHost(fwdHost)) return 'production';
  const origin = headers.get('origin');
  if (origin) {
    try {
      const u = new URL(origin);
      if (!isLocalhostHost(u.host)) return 'production';
    } catch {
      /* ignore */
    }
  }
  const host = headers.get('host');
  if (isLocalhostHost(host)) return 'local';
  if (host) return 'production';
  return 'local';
}

/**
 * Resolve the OAuth redirect_uri for a specific request — environment-aware.
 *
 * PRIORITY (ensures the redirect_uri ALWAYS matches the Zoho API Console):
 *
 *   1. LOCAL development (browser on the same machine as the dev server):
 *        → use `ZOHO_REDIRECT_URI` env var (typically http://localhost:3000/...).
 *          This is what the user has registered in the Zoho API Console for
 *          local development.
 *
 *   2. PREVIEW / PRODUCTION (browser on a different machine, request came
 *      through the gateway or a public hostname):
 *        → use `ZOHO_REDIRECT_URI_PUBLIC` env var if set (the public URL the
 *          user registered in the Zoho API Console for preview/production).
 *        → else fall back to deriving the origin from the request headers
 *          (abc / x-forwarded-host / origin / host).
 *        → else fall back to `ZOHO_REDIRECT_URI` env var (last resort — will
 *          likely fail because the preview browser can't reach localhost).
 *
 *   3. `ZOHO_REDIRECT_URI_DYNAMIC=true` overrides everything and forces
 *      dynamic origin resolution (useful if you have a wildcard registered).
 *
 * CRITICAL: Whatever value is used MUST be registered in the Zoho API Console
 * (Self-Client → Authorized Redirect URIs). The /diagnostics endpoint surfaces
 * the exact value so the user can verify the match.
 */
export function resolveRedirectUri(req: Request): string {
  const forceDynamic = process.env.ZOHO_REDIRECT_URI_DYNAMIC === 'true';
  const envLocal = process.env.ZOHO_REDIRECT_URI;
  const envPublic = process.env.ZOHO_REDIRECT_URI_PUBLIC;

  if (forceDynamic) {
    const origin = resolvePublicOrigin(req);
    return `${origin}${CALLBACK_PATH}`;
  }

  const env = classifyRequestEnvironment(req);

  if (env === 'local') {
    // Local dev — use the localhost env var (must be registered in Zoho console).
    if (envLocal) return envLocal;
    // No env var — derive from the request origin (still localhost).
    const origin = resolvePublicOrigin(req);
    return `${origin}${CALLBACK_PATH}`;
  }

  // Preview / production — prefer the public env var.
  if (envPublic) return envPublic;

  // No public env var — derive from the request origin (gateway-aware).
  // This works ONLY if the derived URL is registered in the Zoho console.
  const origin = resolvePublicOrigin(req);
  const derived = `${origin}${CALLBACK_PATH}`;
  console.warn(
    `[zoho-books] WARNING: ZOHO_REDIRECT_URI_PUBLIC is not set, derived redirect_uri="${derived}" from request. ` +
      `This MUST be registered in the Zoho API Console or OAuth will fail with "redirect_uri mismatch". ` +
      `For local-only testing, complete OAuth from the same machine that runs the dev server.`,
  );
  return derived;
}

/** Resolve the static redirect_uri from env (no request context). */
export function getRedirectUri(): string {
  return (
    process.env.ZOHO_REDIRECT_URI ??
    'http://localhost:3000/api/integrations/zoho/callback'
  );
}

// ─── OAuth state encode/decode (HMAC-signed, nonce, TTL) ─────────────────────
//
// The OAuth `state` param protects against CSRF: an attacker can't trick a
// user into connecting the attacker's Zoho account because the callback
// validates that the state matches what WE issued at /connect time.
//
// To make this protection strong (not just base64-encoded JSON that an
// attacker could craft), the state is:
//   1. A random 16-byte nonce (base64url) — unguessable, single-use feel
//   2. The JSON payload (orgId, userId, returnPath, redirectUri)
//   3. An HMAC-SHA256 signature over (nonce + payload) using a server secret
//   4. A TTL: state expires after 10 minutes (defence-in-depth against replay)
//
// Format: `<nonce>.<base64url(payload)>.<expiresAtMs>.<hmac>`
//
// The HMAC secret is derived from ZOHO_CLIENT_SECRET (already a server-side
// secret) so no additional env var is required. A separate
// ZOHO_OAUTH_STATE_SECRET can override this for environments that rotate
// client secrets independently.

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getStateHmacSecret(): string {
  // Prefer an explicit state secret if set, else derive from the client secret.
  // The client secret is already a server-side value never exposed to the
  // browser, so it's a suitable HMAC key for OAuth state protection.
  return (
    process.env.ZOHO_OAUTH_STATE_SECRET ??
    process.env.ZOHO_CLIENT_SECRET ??
    'gstpilot-zoho-state-fallback-secret-CHANGEME'
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
  // Node 18+ has timingSafeEqual on Buffer — use it to avoid timing attacks.
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return a === b;
  }
}

export function encodeState(input: ZohoOAuthState): string {
  // Generate a random 16-byte nonce (base64url, ~22 chars).
  const nonce = randomBytes(16).toString('base64url');
  const payload = Buffer.from(JSON.stringify(input), 'utf8').toString('base64url');
  const expiresAt = Date.now() + STATE_TTL_MS;
  const message = `${nonce}.${payload}.${expiresAt}`;
  const sig = hmacSign(message);
  return `${message}.${sig}`;
}

export function decodeState(state: string): ZohoOAuthState | null {
  try {
    const parts = state.split('.');
    if (parts.length !== 4) return null;
    const [nonce, payload, expiresAtStr, sig] = parts;
    if (!nonce || !payload || !expiresAtStr || !sig) return null;

    // Verify the HMAC signature (constant-time comparison).
    const message = `${nonce}.${payload}.${expiresAtStr}`;
    const expectedSig = hmacSign(message);
    if (!constantTimeEqual(sig, expectedSig)) {
      console.warn('[zoho/oauth-state] REJECTED: invalid HMAC signature');
      return null;
    }

    // Verify TTL — state expires after STATE_TTL_MS.
    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || Date.now() > expiresAt) {
      console.warn('[zoho/oauth-state] REJECTED: state expired');
      return null;
    }

    const json = Buffer.from(payload, 'base64url').toString('utf8');
    return JSON.parse(json) as ZohoOAuthState;
  } catch (err) {
    console.warn('[zoho/oauth-state] REJECTED: decode error', err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Org/user header resolution (mirrors Google Workspace) ───────────────────

export function resolveOrgUserFromHeaders(req: Request): ResolvedOrgUser {
  const orgId = req.headers.get('x-gstpilot-orgid');
  const actorHeader = req.headers.get('x-gstpilot-actor');
  let userId: string | null = null;
  let userEmail: string | null = null;
  if (actorHeader) {
    try {
      const actor = JSON.parse(actorHeader) as { uid?: string; email?: string };
      userId = actor.uid ?? null;
      userEmail = actor.email ?? null;
    } catch {
      /* ignore malformed actor header */
    }
  }
  return { orgId, userId, userEmail };
}

// ─── OAuth flow ──────────────────────────────────────────────────────────────

/**
 * Build the Zoho OAuth consent-screen URL.
 *
 * Zoho supports `access_type=offline` (issues a refresh token) and
 * `prompt=consent` (forces a fresh consent screen so a new refresh token is
 * issued every connect — same pattern as Google Workspace).
 */
export function buildAuthUrl(state: string, redirectUri?: string): string {
  const { clientId, redirectUri: defaultRedirectUri, endpoints } = getZohoOAuthConfig();
  const uri = redirectUri ?? defaultRedirectUri;
  const params = new URLSearchParams({
    scope: ZOHO_BOOKS_SCOPE,
    client_id: clientId,
    response_type: 'code',
    redirect_uri: uri,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${endpoints.authBaseUrl}?${params.toString()}`;
}

function emptyTokens(): ZohoTokens {
  return {
    accessToken: '',
    refreshToken: '',
    expiryDate: null,
    scope: '',
    tokenType: 'Bearer',
    apiDomain: null,
  };
}

/**
 * Exchange an authorization code for access + refresh tokens.
 *
 * Returns `{ tokens, userInfo, error }`. On failure, `tokens` is the empty
 * shape and `error` is a human-readable string. Never throws.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri?: string,
): Promise<ZohoTokenExchangeResult> {
  const { clientId, clientSecret, redirectUri: defaultRedirectUri, endpoints } = getZohoOAuthConfig();
  const uri = redirectUri ?? defaultRedirectUri;

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: uri,
    grant_type: 'authorization_code',
  });

  let resp: Response;
  try {
    resp = await fetch(endpoints.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch (err) {
    return {
      tokens: emptyTokens(),
      userInfo: {},
      error: err instanceof Error ? err.message : 'Network error calling Zoho token endpoint.',
    };
  }

  const text = await resp.text();
  if (!resp.ok) {
    return {
      tokens: emptyTokens(),
      userInfo: {},
      error: `Token exchange failed (${resp.status}): ${text.slice(0, 500)}`,
    };
  }

  let data: ZohoTokenExchangeResponse;
  try {
    data = JSON.parse(text) as ZohoTokenExchangeResponse;
  } catch {
    return {
      tokens: emptyTokens(),
      userInfo: {},
      error: `Token exchange response was not valid JSON: ${text.slice(0, 200)}`,
    };
  }

  if (data.error || !data.access_token) {
    return {
      tokens: emptyTokens(),
      userInfo: {},
      error: data.error
        ? `${data.error}${data.error_description ? `: ${data.error_description}` : ''}`
        : 'No access_token in Zoho response.',
    };
  }

  const expiryDate = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : null;

  const tokens: ZohoTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? '',
    expiryDate,
    scope: data.scope ?? ZOHO_BOOKS_SCOPE,
    tokenType: data.token_type ?? 'Bearer',
    apiDomain: data.api_domain ?? null,
  };

  // Zoho doesn't return an id_token — fetch the user profile best-effort for
  // audit logging. Non-fatal: if this fails, we still have valid tokens.
  const userInfo = await fetchUserInfo(tokens.accessToken, tokens.apiDomain).catch(() => ({}));

  return { tokens, userInfo, error: null };
}

/**
 * Best-effort fetch of the connecting user's Zoho profile (for audit logging).
 * Uses the generic /users/me endpoint at the data-center's accounts host.
 */
async function fetchUserInfo(accessToken: string, apiDomain: string | null): Promise<ZohoUserInfo> {
  try {
    // Zoho exposes the user profile at <apiDomain>/users/me — but apiDomain
    // from the token response is the Books API domain. The accounts-domain
    // user endpoint is what we actually want, derived from the DC.
    const dc = resolveDataCenter();
    const accountsHost =
      dc === 'com' ? 'https://accounts.zoho.com' :
      dc === 'in' ? 'https://accounts.zoho.in' :
      dc === 'eu' ? 'https://accounts.zoho.eu' :
      dc === 'au' ? 'https://accounts.zoho.com.au' :
      dc === 'jp' ? 'https://accounts.zoho.jp' :
      'https://accounts.zoho.ca';
    const url = `${accountsHost}/oauth/userinfo`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!resp.ok) return {};
    const data = (await resp.json()) as {
      User_id?: string;
      Email?: string;
      First_Name?: string;
      Last_Name?: string;
      Display_Name?: string;
    };
    return {
      userId: data.User_id,
      email: data.Email,
      fullName:
        data.Display_Name ??
        ([data.First_Name, data.Last_Name].filter(Boolean).join(' ') || undefined),
    };
  } catch {
    return {};
  }
  // apiDomain is currently unused but persisted for future use.
  void apiDomain;
}

// ─── Token persistence ───────────────────────────────────────────────────────

/** Prisma row type (loose-typed to avoid coupling to the generated client). */
interface ZohoTokenRow {
  id: string;
  organizationId: string;
  userId: string;
  userEmail: string;
  zohoUserId: string | null;
  zohoOrgId: string | null;
  zohoOrgName: string | null;
  accessToken: string;
  refreshToken: string;
  expiryDate: Date | null;
  scope: string;
  tokenType: string;
  apiDomain: string | null;
  dataCenter: string;
  connectedAt: Date;
  updatedAt: Date;
  revokedAt: Date | null;
}

/**
 * Persist (upsert) the encrypted Zoho tokens for an (org, user) pair.
 *
 * If Zoho omitted a refresh_token on re-consent, the previously-stored one is
 * preserved (same guard as the Google Workspace integration).
 *
 * After storing the tokens, the user's default Zoho Books organization is
 * fetched and written back to the row (multi-tenant mapping).
 */
export async function storeTokens(
  organizationId: string,
  userId: string,
  userEmail: string,
  zohoUserId: string | null,
  tokens: ZohoTokens,
): Promise<StoredZohoToken> {
  const existing = await db.zohoBooksToken.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });

  // Preserve the existing refresh token if Zoho didn't return a new one.
  const refreshTokenEnc = tokens.refreshToken
    ? encrypt(tokens.refreshToken)
    : existing?.refreshToken ?? '';

  const dc = resolveDataCenter();

  const row = await db.zohoBooksToken.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    create: {
      organizationId,
      userId,
      userEmail,
      zohoUserId,
      accessToken: encrypt(tokens.accessToken),
      refreshToken: refreshTokenEnc,
      expiryDate: tokens.expiryDate,
      scope: tokens.scope,
      tokenType: tokens.tokenType,
      apiDomain: tokens.apiDomain,
      dataCenter: dc,
      revokedAt: null,
    },
    update: {
      userEmail,
      zohoUserId,
      accessToken: encrypt(tokens.accessToken),
      refreshToken: refreshTokenEnc,
      expiryDate: tokens.expiryDate,
      scope: tokens.scope,
      tokenType: tokens.tokenType,
      apiDomain: tokens.apiDomain,
      dataCenter: dc,
      revokedAt: null,
    },
  });

  // Best-effort multi-tenant mapping: fetch the user's default Zoho Books
  // organization and persist its id + name. Non-fatal — if this fails the
  // tokens are still valid; the status UI just won't show the org name.
  void refreshOrganizationMapping(organizationId, userId, tokens.accessToken);

  return toStored(row);
}

/**
 * Fetch the user's Zoho Books organizations and persist the default (or first)
 * one's id + name to the token row. Used by storeTokens + the /refresh route.
 */
export async function refreshOrganizationMapping(
  organizationId: string,
  userId: string,
  accessToken: string,
): Promise<{ zohoOrgId: string | null; zohoOrgName: string | null; error: string | null }> {
  try {
    const endpoints = getZohoEndpoints();
    const resp = await fetch(`${endpoints.apiBaseUrl}/organizations`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return { zohoOrgId: null, zohoOrgName: null, error: `Organizations fetch failed (${resp.status}): ${text.slice(0, 200)}` };
    }
    const data = (await resp.json()) as { organizations?: Array<{ organization_id: string; name: string; is_default_org?: boolean }> };
    const orgs = data.organizations ?? [];
    if (orgs.length === 0) {
      return { zohoOrgId: null, zohoOrgName: null, error: 'No Zoho Books organizations found for this account.' };
    }
    const primary = orgs.find((o) => o.is_default_org) ?? orgs[0];
    if (!primary) {
      return { zohoOrgId: null, zohoOrgName: null, error: null };
    }
    await db.zohoBooksToken.update({
      where: { organizationId_userId: { organizationId, userId } },
      data: { zohoOrgId: primary.organization_id, zohoOrgName: primary.name },
    });
    return { zohoOrgId: primary.organization_id, zohoOrgName: primary.name, error: null };
  } catch (err) {
    return {
      zohoOrgId: null,
      zohoOrgName: null,
      error: err instanceof Error ? err.message : 'Failed to fetch Zoho organizations.',
    };
  }
}

/**
 * Load + decrypt the stored tokens for an (org, user) pair.
 * Returns `{ tokens: null, stored: null }` if not connected or revoked.
 */
export async function loadTokens(
  organizationId: string,
  userId: string,
): Promise<{ tokens: ZohoTokens | null; stored: StoredZohoToken | null }> {
  const row = (await db.zohoBooksToken.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  })) as ZohoTokenRow | null;

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
      apiDomain: row.apiDomain,
    },
    stored: toStored(row),
  };
}

/**
 * Resolve a valid (non-expired) access token for the (org, user) pair,
 * refreshing it transparently if it's within 60s of expiry.
 *
 * This is the entry point every service route uses — refresh is implicit.
 */
export async function getValidAccessToken(
  organizationId: string,
  userId: string,
): Promise<{ accessToken: string | null; error: string | null; permanent: boolean }> {
  const { tokens, stored } = await loadTokens(organizationId, userId);
  if (!tokens || !stored) {
    return {
      accessToken: null,
      error: 'Zoho Books is not connected. Connect your account first.',
      permanent: true,
    };
  }

  // Still valid? Return immediately.
  if (tokens.expiryDate && tokens.expiryDate.getTime() > Date.now() + 60_000) {
    return { accessToken: tokens.accessToken, error: null, permanent: false };
  }

  // Need to refresh.
  if (!tokens.refreshToken) {
    return {
      accessToken: null,
      error: 'No refresh token available. Please reconnect Zoho Books.',
      permanent: true,
    };
  }

  const refreshed = await refreshAccessToken(tokens.refreshToken);
  if (refreshed.error || !refreshed.accessToken) {
    return { accessToken: null, error: refreshed.error ?? 'Token refresh failed.', permanent: refreshed.permanent };
  }

  const newExpiry = refreshed.expiresIn
    ? new Date(Date.now() + refreshed.expiresIn * 1000)
    : null;

  try {
    await db.zohoBooksToken.update({
      where: { id: stored.id },
      data: {
        accessToken: encrypt(refreshed.accessToken),
        expiryDate: newExpiry,
        apiDomain: refreshed.apiDomain ?? undefined,
      },
    });
  } catch (err) {
    console.warn('[zoho-books] failed to persist refreshed token:', err);
  }

  return { accessToken: refreshed.accessToken, error: null };
}

/**
 * Refresh an access token using a refresh token. Returns the new access token
 * + expiry. Never throws — callers destructure `{ accessToken, error }`.
 */
export async function refreshAccessToken(refreshToken: string): Promise<ZohoRefreshResult> {
  const { clientId, clientSecret, endpoints } = getZohoOAuthConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  try {
    const resp = await fetch(endpoints.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!resp.ok) {
      const text = await resp.text();
      // HTTP 400 + invalid_grant = refresh token genuinely revoked.
      // HTTP 401/403 = invalid client credentials.
      // These are PERMANENT — the user must re-run OAuth.
      const isPermanent = resp.status === 400 || resp.status === 401 || resp.status === 403;
      return {
        accessToken: null,
        expiresIn: null,
        apiDomain: null,
        error: `Refresh failed (${resp.status}): ${text.slice(0, 500)}`,
        permanent: isPermanent,
      };
    }
    const data = (await resp.json()) as {
      access_token?: string;
      expires_in?: number;
      api_domain?: string;
      error?: string;
    };
    if (data.error || !data.access_token) {
      return {
        accessToken: null,
        expiresIn: null,
        apiDomain: null,
        error: data.error ?? 'No access_token in refresh response.',
        permanent: true,
      };
    }
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in ?? null,
      apiDomain: data.api_domain ?? null,
      error: null,
      permanent: false,
    };
  } catch (err) {
    // Network error (DNS, timeout, connection refused) — TEMPORARY.
    // The refresh token is still valid; the user should NOT be told to reconnect.
    return {
      accessToken: null,
      expiresIn: null,
      apiDomain: null,
      error: err instanceof Error ? err.message : 'Token refresh request failed.',
      permanent: false,
    };
  }
}

// ─── Disconnect ──────────────────────────────────────────────────────────────

/**
 * Disconnect Zoho Books for an (org, user) pair:
 *   1. Best-effort revoke the access token at Zoho
 *   2. Mark the row revoked + clear encrypted tokens
 *
 * Never throws — returns `{ error }`.
 */
export async function disconnectZoho(
  organizationId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { tokens, stored } = await loadTokens(organizationId, userId);
  if (!stored) return { error: null };

  // Best-effort revoke. Zoho's revoke endpoint accepts the access OR refresh
  // token as a query param and returns 200 regardless.
  if (tokens?.accessToken) {
    try {
      const endpoints = getZohoEndpoints();
      await fetch(`${endpoints.tokenUrl}/revoke?token=${tokens.accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch (err) {
      console.warn('[zoho-books] revoke request failed:', err);
    }
  }

  try {
    await db.zohoBooksToken.update({
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
 * Read the public connection status for an (org, user) pair. Never exposes
 * token strings — only metadata.
 *
 * HONESTY CONTRACT (production requirement):
 *   `connected` is TRUE **only** when ALL of the following hold:
 *     1. A non-revoked token row exists for this (org, user) pair.
 *     2. ZOHO_CLIENT_ID + ZOHO_CLIENT_SECRET are set in the environment.
 *     3. The stored access token can be decrypted with the current secret.
 *
 *   If (2) or (3) fail, `connected` is `false`, `requiresReconnect` is `true`,
 *   and `reason` explains what happened — so the UI NEVER shows a fake
 *   "Connected" dashboard when the server cannot actually call the Zoho API.
 */
export async function getConnectionStatus(
  organizationId: string,
  userId: string,
): Promise<ZohoConnectionStatus> {
  // ERROR (not configured) — env vars missing. Check FIRST so the UI shows an
  // honest "Configuration required" state even when no token row exists yet
  // (first visit). Mirrors the connect route's ZOHO_NOT_CONFIGURED
  // short-circuit and the Google Workspace pattern.
  const hasClientId = Boolean(process.env.ZOHO_CLIENT_ID);
  const hasClientSecret = Boolean(process.env.ZOHO_CLIENT_SECRET);
  if (!hasClientId || !hasClientSecret) {
    // Try to read the token row for context (user email, last connected) but
    // don't require it — the not-configured state is meaningful even with no
    // prior connection.
    const row = (await db.zohoBooksToken.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    }).catch(() => null)) as ZohoTokenRow | null;
    return {
      connected: false,
      userEmail: row?.userEmail ?? null,
      zohoUserId: row?.zohoUserId ?? null,
      connectedAt: row?.connectedAt.toISOString() ?? null,
      lastConnectedAt: row?.updatedAt.toISOString() ?? null,
      scopes: row?.scope ? row.scope.split(',').map((s) => s.trim()).filter(Boolean) : [],
      organizationName: row?.zohoOrgName ?? null,
      zohoOrgId: row?.zohoOrgId ?? null,
      dataCenter: row?.dataCenter ?? null,
      scopeAreas: ZOHO_BOOKS_SCOPE_AREAS,
      requiresReconnect: false,
      notConfigured: true,
      reason:
        'Zoho Books OAuth credentials are not configured on this server. An administrator must set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET before the connection can be used.',
    };
  }

  const row = (await db.zohoBooksToken.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  })) as ZohoTokenRow | null;

  // Case 1: No token row OR explicitly revoked → genuinely not connected.
  if (!row || row.revokedAt) {
    return {
      connected: false,
      userEmail: row?.userEmail ?? null,
      zohoUserId: null,
      connectedAt: row?.connectedAt.toISOString() ?? null,
      lastConnectedAt: row?.updatedAt.toISOString() ?? null,
      scopes: [],
      organizationName: null,
      zohoOrgId: null,
      dataCenter: null,
      scopeAreas: ZOHO_BOOKS_SCOPE_AREAS,
      requiresReconnect: false,
      notConfigured: false,
      reason: null,
    };
  }

  //   (b) Can the access token be decrypted with the current secret?
  //       safeDecrypt returns null on any failure (wrong key, corrupt payload,
  //       tamper). This catches the "secret was rotated" case — the row exists
  //       but the tokens are effectively useless.
  const decryptedAccess = safeDecrypt(row.accessToken);
  if (!decryptedAccess) {
    return {
      connected: false,
      userEmail: row.userEmail,
      zohoUserId: row.zohoUserId,
      connectedAt: row.connectedAt.toISOString(),
      lastConnectedAt: row.updatedAt.toISOString(),
      scopes: row.scope ? row.scope.split(',').map((s) => s.trim()).filter(Boolean) : [],
      organizationName: row.zohoOrgName,
      zohoOrgId: row.zohoOrgId,
      dataCenter: row.dataCenter,
      scopeAreas: ZOHO_BOOKS_SCOPE_AREAS,
      requiresReconnect: true,
      notConfigured: false,
      reason:
        'The stored Zoho Books tokens cannot be decrypted. This usually means the ZOHO_CLIENT_SECRET was rotated since the last connection. Please reconnect Zoho Books.',
    };
  }

  // Case 3: Fully usable — row exists, credentials configured, tokens decrypt.
  // This is the ONLY path that returns connected: true.
  return {
    connected: true,
    userEmail: row.userEmail,
    zohoUserId: row.zohoUserId,
    connectedAt: row.connectedAt.toISOString(),
    lastConnectedAt: row.updatedAt.toISOString(),
    scopes: row.scope ? row.scope.split(',').map((s) => s.trim()).filter(Boolean) : [],
    organizationName: row.zohoOrgName,
    zohoOrgId: row.zohoOrgId,
    dataCenter: row.dataCenter,
    scopeAreas: ZOHO_BOOKS_SCOPE_AREAS,
    requiresReconnect: false,
    notConfigured: false,
    reason: null,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toStored(row: ZohoTokenRow): StoredZohoToken {
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    userEmail: row.userEmail,
    zohoUserId: row.zohoUserId,
    zohoOrgId: row.zohoOrgId,
    zohoOrgName: row.zohoOrgName,
    apiDomain: row.apiDomain,
    dataCenter: row.dataCenter,
    connectedAt: row.connectedAt,
    updatedAt: row.updatedAt,
    revokedAt: row.revokedAt,
  };
}
