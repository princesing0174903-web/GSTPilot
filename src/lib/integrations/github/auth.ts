// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — GitHub OAuth Helpers (server-only)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Implements the canonical GitHub OAuth web authorization flow:
//   1. `buildAuthUrl(state, redirectUri)` — GitHub consent URL.
//   2. `exchangeCodeForTokens(code, redirectUri)` — POST to GitHub token endpoint.
//   3. `fetchGitHubUser(accessToken)` — GET /user from GitHub API.
//   4. `encodeState` / `decodeState` — HMAC-SHA256-signed OAuth state with
//      10-minute TTL + 16-byte nonce echo (CSRF + login-injection defense).
//   5. `resolveRedirectUri(req)` — runtime origin discovery (mirrors Google's
//      7-step fallback so the same callback URL works in sandbox + production).
//
// SECURITY:
//   • GITHUB_APP_CLIENT_SECRET is read from process.env — NEVER sent to the browser.
//   • The state HMAC + nonce echo guarantees the callback came from OUR authorize
//     endpoint (not a CSRF), and is no older than 10 minutes.
//   • The redirect_uri passed to GitHub's token endpoint is taken from the signed
//     state — an attacker can't substitute their own.
//   • Access tokens are NEVER persisted (login-only flow — STEP 12 of the spec
//     explicitly allows this when no future GitHub API access is required).
//
// ENV:
//   GITHUB_APP_CLIENT_ID     — required (public, can appear in auth URL)
//   GITHUB_APP_CLIENT_SECRET  — required (NEVER expose to browser)
//   GITHUB_OAUTH_STATE_SECRET — optional (defaults to GITHUB_APP_CLIENT_SECRET,
//                               domain-separated via HMAC label so it's not the
//                               same key used for any other purpose)
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'node:crypto';

// ── Env accessors ─────────────────────────────────────────────────────────────

export function isGitHubConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_APP_CLIENT_ID &&
    process.env.GITHUB_APP_CLIENT_SECRET
  );
}

export function getGitHubClientId(): string {
  return process.env.GITHUB_APP_CLIENT_ID ?? '';
}

function getGitHubClientSecret(): string {
  return process.env.GITHUB_APP_CLIENT_SECRET ?? '';
}

// ── State encoding (HMAC-signed, 10-min TTL, nonce echo) ─────────────────────
//
// Format: <nonce.b64url>.<payload.b64url>.<expiresAt>.<hmac.b64url>
// Same proven pattern as src/lib/integrations/google/auth.ts.

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getStateKey(): string {
  // Domain-separated via HMAC label — even if the operator reuses the same
  // secret value for GITHUB_OAUTH_STATE_SECRET and GITHUB_APP_CLIENT_SECRET,
  // the derived key here is unique to this code path.
  const base = process.env.GITHUB_OAUTH_STATE_SECRET ?? getGitHubClientSecret();
  const h1 = crypto.createHmac('sha256', 'gstpilot-github-v1').update(base).digest();
  return crypto.createHmac('sha256', h1).update('oauth-state-key').digest();
}

export interface GitHubOAuthStatePayload {
  returnPath: string | null;
  redirectUri: string;
  n: string; // nonce echo — verified on decode
}

export function encodeState(payload: Omit<GitHubOAuthStatePayload, 'n'>): string {
  const nonce = crypto.randomBytes(16);
  const fullPayload: GitHubOAuthStatePayload = {
    ...payload,
    n: nonce.toString('base64url'),
  };
  const payloadB64 = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const expiresAt = Date.now() + STATE_TTL_MS;
  const hmac = crypto.createHmac('sha256', getStateKey())
    .update(`${nonce.toString('base64url')}.${payloadB64}.${expiresAt}`)
    .digest('base64url');
  return `${nonce.toString('base64url')}.${payloadB64}.${expiresAt}.${hmac}`;
}

export function decodeState(state: string): GitHubOAuthStatePayload | null {
  try {
    const parts = state.split('.');
    if (parts.length !== 4) return null;
    const [nonceB64, payloadB64, expiresAtStr, hmacB64] = parts;
    const nonce = Buffer.from(nonceB64, 'base64url');
    if (nonce.length !== 16) return null;

    const expiresAt = parseInt(expiresAtStr, 10);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
      return null;
    }

    const expectedHmac = crypto.createHmac('sha256', getStateKey())
      .update(`${nonceB64}.${payloadB64}.${expiresAtStr}`)
      .digest('base64url');

    // Constant-time comparison to prevent timing attacks.
    const a = Buffer.from(hmacB64, 'base64url');
    const b = Buffer.from(expectedHmac, 'base64url');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as GitHubOAuthStatePayload;
    // Nonce echo — defense-in-depth against nonce substitution under same key.
    if (payload.n !== nonceB64) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Redirect URI resolution (runtime origin discovery) ───────────────────────
//
// Mirrors the Google Workspace auth.ts resolveRedirectUri — same proven
// 7-step fallback chain so the callback URL is always correct in sandbox,
// preview, and production:
//   1. GITHUB_REDIRECT_URI env var (if set)
//   2. `abc` header — preview-gateway marker (host name)
//   3. `Origin` header
//   4. `X-Forwarded-Host` + `X-Forwarded-Proto`
//   5. `Host` header (proto inferred from localhost)
//   6. req.url origin
//   7. http://localhost:3000

export function resolveRedirectUri(req: Request): string {
  // 1. Env override
  const envUri = process.env.GITHUB_REDIRECT_URI;
  if (envUri) {
    try {
      const parsed = new URL(envUri);
      return `${parsed.protocol}//${parsed.host}/api/auth/github/callback`;
    } catch (e) {
      // If unparseable, fall through to request-based resolution
    }
  }

  const url = new URL(req.url);

  // 2. abc header (preview gateway marker)
  const abc = req.headers.get('abc');
  if (abc) {
    const proto = url.protocol.replace(':', '');
    return `${proto}://${abc}/api/auth/github/callback`;
  }

  // 3. Origin header
  const origin = req.headers.get('origin');
  if (origin) return `${origin}/api/auth/github/callback`;

  // 4. X-Forwarded-Host + X-Forwarded-Proto
  const fwdHost = req.headers.get('x-forwarded-host');
  const fwdProto = req.headers.get('x-forwarded-proto');
  if (fwdHost) {
    const proto = fwdProto ?? 'https';
    return `${proto}://${fwdHost}/api/auth/github/callback`;
  }

  // 5. Host header (proto inferred from localhost)
  const host = req.headers.get('host');
  if (host) {
    const isLocal = host.startsWith('localhost') || host.startsWith('127.');
    const proto = isLocal ? 'http' : 'https';
    return `${proto}://${host}/api/auth/github/callback`;
  }

  // 6. req.url origin
  return `${url.protocol}//${url.host}/api/auth/github/callback`;
}

// ── Authorization URL ─────────────────────────────────────────────────────────

export function buildAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: getGitHubClientId(),
    redirect_uri: redirectUri,
    state,
    scope: 'read:user user:email', // minimum for login (STEP 6 + STEP 13)
    allow_signup: 'true',
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

// ── Token exchange ────────────────────────────────────────────────────────────

export interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export interface GitHubExchangeResult {
  tokens: GitHubTokenResponse | null;
  error: string | null;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<GitHubExchangeResult> {
  try {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: getGitHubClientId(),
        client_secret: getGitHubClientSecret(),
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!res.ok) {
      return { tokens: null, error: `GitHub token endpoint returned HTTP ${res.status}` };
    }

    const body = (await res.json()) as GitHubTokenResponse & { error?: string; error_description?: string };
    if (body.error || !body.access_token) {
      return { tokens: null, error: body.error_description ?? body.error ?? 'GitHub did not return an access token' };
    }

    return { tokens: body, error: null };
  } catch (err) {
    return {
      tokens: null,
      error: err instanceof Error ? err.message : 'Network error during GitHub token exchange',
    };
  }
}

// ── GitHub user lookup ───────────────────────────────────────────────────────

export interface GitHubUser {
  id: number;          // stable numeric GitHub user ID — the canonical providerUserId
  login: string;       // GitHub username (may change — never use as primary key)
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  html_url: string;
}

export interface GitHubUserResult {
  user: GitHubUser | null;
  error: string | null;
}

export async function fetchGitHubUser(accessToken: string): Promise<GitHubUserResult> {
  try {
    // 1. GET /user — primary profile (id + login + name + avatar)
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!userRes.ok) {
      return { user: null, error: `GitHub /user returned HTTP ${userRes.status}` };
    }
    const profile = (await userRes.json()) as Partial<GitHubUser> & {
      email?: string | null;
    };

    // 2. Email resolution — GitHub may not return email in /user (privacy).
    //    If email is missing/null, query /user/emails for the primary+verified one.
    let email = profile.email ?? null;
    if (!email) {
      try {
        const emailsRes = await fetch('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });
        if (emailsRes.ok) {
          const emails = (await emailsRes.json()) as Array<{
            email: string;
            primary: boolean;
            verified: boolean;
            visibility: string | null;
          }>;
          // Pick the primary+verified email. If none, fall back to any verified email.
          const primaryVerified = emails.find((e) => e.primary && e.verified);
          const anyVerified = emails.find((e) => e.verified);
          email = primaryVerified?.email ?? anyVerified?.email ?? null;
        }
      } catch {
        // Non-fatal — we still have GitHub user ID for identity.
      }
    }

    const user: GitHubUser = {
      id: profile.id!,
      login: profile.login!,
      name: profile.name ?? null,
      email,
      avatar_url: profile.avatar_url ?? null,
      html_url: profile.html_url ?? `https://github.com/${profile.login}`,
    };

    return { user, error: null };
  } catch (err) {
    return {
      user: null,
      error: err instanceof Error ? err.message : 'Network error during GitHub user lookup',
    };
  }
}
