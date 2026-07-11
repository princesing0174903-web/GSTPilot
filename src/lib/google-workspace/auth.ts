// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Google Workspace OAuth Client + Token Store
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
  redirectUri: string;
}

/**
 * Resolve the Google OAuth config from environment variables.
 *
 * `GOOGLE_REDIRECT_URI` is the SINGLE source of truth for the OAuth redirect
 * URI — it is sent to Google in the authorize URL AND in the token-exchange
 * request (they MUST match exactly, and MUST match one of the "Authorized
 * redirect URIs" registered in Google Cloud Console).
 *
 * Set it differently per environment:
 *   • Local development (.env):        http://localhost:3000/api/integrations/google/callback
 *   • Production (.env.production):    https://your-domain.com/api/integrations/google/callback
 *
 * We deliberately do NOT derive the redirect URI from request headers
 * (X-Forwarded-Host / Host) — that would cause the URI to change based on how
 * the app is accessed (preview hostname vs localhost), which breaks the
 * exact-match requirement against Google Cloud Console's authorized list.
 */
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

/**
 * Get the OAuth redirect URI — always `GOOGLE_REDIRECT_URI` from env (with a
 * localhost fallback). Kept as a named export so callers and the debug
 * endpoint can reference the same source of truth the OAuth flow uses.
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
 * The `redirect_uri` parameter is always `GOOGLE_REDIRECT_URI` from env
 * (localhost for local dev, deployment URL for production). It must match
 * exactly one of the "Authorized redirect URIs" registered in Google Cloud
 * Console → Credentials → OAuth 2.0 Client.
 */
export function buildAuthUrl(state: string): string {
  const { clientId, redirectUri } = getGoogleOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline',
    prompt: 'consent', // force a fresh refresh token every connect
    include_granted_scopes: 'true',
    state,
  });
  return `${GOOGLE_AUTH_BASE}?${params.toString()}`;
}

/**
 * Encode a safe state token for the OAuth round-trip. Base64-URL JSON so the
 * callback can decode orgId/userId/return without a separate store.
 */
export function encodeState(input: {
  orgId: string;
  userId: string;
  userEmail: string;
  returnPath?: string;
}): string {
  const json = JSON.stringify(input);
  return Buffer.from(json, 'utf8').toString('base64url');
}

export function decodeState(state: string): {
  orgId: string;
  userId: string;
  userEmail: string;
  returnPath?: string;
} | null {
  try {
    const json = Buffer.from(state, 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
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
 * The `redirect_uri` passed to Google's token endpoint MUST be the same URI
 * that was used in the `buildAuthUrl` call — Google rejects mismatches with
 * `redirect_uri_mismatch`. We always use `GOOGLE_REDIRECT_URI` from env in
 * both places, so they are guaranteed to match.
 */
export async function exchangeCodeForTokens(
  code: string,
): Promise<{ tokens: GoogleTokens; userInfo: UserInfoResponse; error: string | null }> {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
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
 * Returns `{ accessToken, error }` — on error, the caller should surface a
 * "reconnect Google" prompt to the user.
 */
export async function getValidAccessToken(
  organizationId: string,
  userId: string,
): Promise<{ accessToken: string | null; error: string | null }> {
  const { tokens, stored } = await loadTokens(organizationId, userId);
  if (!tokens || !stored) {
    return { accessToken: null, error: 'Google Workspace is not connected. Connect your account first.' };
  }

  // If the access token is still valid (with a 60s safety margin), use it.
  if (tokens.expiryDate && tokens.expiryDate.getTime() > Date.now() + 60_000) {
    return { accessToken: tokens.accessToken, error: null };
  }

  // Need to refresh.
  if (!tokens.refreshToken) {
    return { accessToken: null, error: 'No refresh token available. Please reconnect Google Workspace.' };
  }

  const refreshed = await refreshAccessToken(tokens.refreshToken);
  if (refreshed.error || !refreshed.accessToken) {
    return { accessToken: null, error: refreshed.error ?? 'Token refresh failed.' };
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

  return { accessToken: refreshed.accessToken, error: null };
}

interface RefreshResult {
  accessToken: string | null;
  expiresIn: number | null;
  error: string | null;
}

/**
 * Exchange a refresh token for a new access token.
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
      return { accessToken: null, expiresIn: null, error: `Refresh failed (${resp.status}): ${text}` };
    }
    const data = (await resp.json()) as { access_token?: string; expires_in?: number };
    return {
      accessToken: data.access_token ?? null,
      expiresIn: data.expires_in ?? null,
      error: null,
    };
  } catch (err) {
    return {
      accessToken: null,
      expiresIn: null,
      error: err instanceof Error ? err.message : 'Token refresh request failed.',
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

export interface ConnectionStatus {
  connected: boolean;
  userEmail: string | null;
  googleUserId: string | null;
  connectedAt: string | null;
  scopes: string[];
}

export async function getConnectionStatus(
  organizationId: string,
  userId: string,
): Promise<ConnectionStatus> {
  const row = await db.googleWorkspaceToken.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  if (!row || row.revokedAt) {
    return { connected: false, userEmail: null, googleUserId: null, connectedAt: null, scopes: [] };
  }
  return {
    connected: true,
    userEmail: row.userEmail,
    googleUserId: row.googleUserId,
    connectedAt: row.connectedAt.toISOString(),
    scopes: row.scope ? row.scope.split(' ') : [],
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
export function resolveOrgUserFromHeaders(req: Request): {
  orgId: string | null;
  userId: string | null;
  userEmail: string | null;
} {
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
      /* ignore */
    }
  }
  return { orgId, userId, userEmail };
}

/** Decrypt helper re-export for service libs that need raw token access. */
export { decrypt };
