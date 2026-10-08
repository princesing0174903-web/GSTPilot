// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/auth/github/callback
// ═══════════════════════════════════════════════════════════════════════════════
//
// GitHub's OAuth redirect target. After the user authorizes VEYRO on
// GitHub's consent page, GitHub redirects here with `?code=...&state=...`
// (or `?error=access_denied` if they cancelled).
//
// FLOW:
//   1. Parse `code` + `state` from the query string (or `error` for denial).
//   2. decodeState → verifies HMAC + TTL + nonce echo (CSRF defense).
//   3. exchangeCodeForTokens(code, redirectUri-from-state) → GitHub access token.
//   4. fetchGitHubUser(accessToken) → GitHub user profile + verified email.
//   5. resolveGitHubUser(githubUser) → finds-or-creates Prisma User
//      (Case A: linked by GitHub ID, Case B: linked by verified email,
//       Case C: new user).
//   6. issueSessionCookie(resolvedUser) → HMAC-signed JWT with identity claims.
//   7. Set httpOnly cookie `gstpilot_session_jwt`.
//   8. Redirect to `/?github_connected=1` (or `/?github_error=<code>` on failure).
//
// SECURITY:
//   • The state HMAC + nonce echo guarantees the request came from OUR
//     authorize endpoint, and is no older than 10 minutes.
//   • The redirect_uri passed to GitHub's token endpoint is taken from the
//     signed state — an attacker can't substitute their own.
//   • The GitHub access token is used ONLY during this request to fetch the
//     user profile — it is NEVER persisted (STEP 12).
//   • The session JWT does NOT contain the GitHub access token.
//   • Errors are surfaced as `?github_error=<code>` — no internal details
//     leak to the browser.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  decodeState,
  exchangeCodeForTokens,
  fetchGitHubUser,
} from '@/lib/integrations/github/auth';
import {
  resolveGitHubUser,
  issueSessionCookie,
  buildSessionCookieHeader,
} from '@/lib/integrations/github/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function failRedirect(code: string, origin: string | null): NextResponse {
  // Redirect to the app root with a safe error code. The login page reads
  // ?github_error=<code> and surfaces a friendly message.
  const base = origin ?? 'http://localhost:3000';
  const url = new URL('/?github_error=' + encodeURIComponent(code), base);
  return NextResponse.redirect(url);
}

function successRedirect(returnPath: string | null, origin: string | null): NextResponse {
  const base = origin ?? 'http://localhost:3000';
  const safePath = returnPath && returnPath.startsWith('/') && !returnPath.startsWith('//')
    ? returnPath
    : '/';
  const url = new URL(safePath, base);
  url.searchParams.set('github_connected', '1');
  return NextResponse.redirect(url);
}

function detectOrigin(req: Request): string | null {
  // Mirror resolveRedirectUri's logic to get the app origin for redirects.
  const envUri = process.env.GITHUB_REDIRECT_URI;
  if (envUri) {
    try {
      return new URL(envUri).origin;
    } catch {
      // fall through
    }
  }
  const url = new URL(req.url);
  const abc = req.headers.get('abc');
  if (abc) {
    return `${url.protocol.replace(':', '')}://${abc}`;
  }
  const origin = req.headers.get('origin');
  if (origin) return origin;
  const fwdHost = req.headers.get('x-forwarded-host');
  const fwdProto = req.headers.get('x-forwarded-proto');
  if (fwdHost) {
    return `${fwdProto ?? 'https'}://${fwdHost}`;
  }
  const host = req.headers.get('host');
  if (host) {
    const isLocal = host.startsWith('localhost') || host.startsWith('127.');
    return `${isLocal ? 'http' : 'https'}://${host}`;
  }
  return `${url.protocol}//${url.host}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const githubError = url.searchParams.get('error');
  const origin = detectOrigin(req);

  // ── User declined consent on GitHub's page ──
  if (githubError) {
    return failRedirect(`github_${githubError}`, origin);
  }

  // ── Missing required parameters ──
  if (!code || !stateParam) {
    return failRedirect('missing_params', origin);
  }

  // ── 2. Verify the state (HMAC + TTL + nonce echo) ──
  const statePayload = decodeState(stateParam);
  if (!statePayload) {
    return failRedirect('invalid_state', origin);
  }

  // ── 3. Exchange the code for an access token ──
  //    Pass the SAME redirect_uri that was used in the authorize request
  //    (stored in the signed state — required so GitHub's check matches).
  const exchangeResult = await exchangeCodeForTokens(code, statePayload.redirectUri);
  if (exchangeResult.error || !exchangeResult.tokens) {
    console.warn('[github/callback] Token exchange failed:', exchangeResult.error);
    return failRedirect('token_exchange_failed', origin);
  }

  // ── 4. Fetch the GitHub user profile + verified email ──
  const userResult = await fetchGitHubUser(exchangeResult.tokens.access_token);
  if (userResult.error || !userResult.user) {
    console.warn('[github/callback] GitHub user lookup failed:', userResult.error);
    return failRedirect('user_lookup_failed', origin);
  }

  // ── 5. Resolve the VEYRO user (find-or-create + safe account linking) ──
  let resolved;
  try {
    resolved = await resolveGitHubUser(userResult.user);
  } catch (err) {
    console.warn('[github/callback] User resolution failed:', (err as Error).message);
    return failRedirect('user_resolution_failed', origin);
  }

  // ── 6. Issue the session JWT cookie ──
  const jwt = issueSessionCookie(resolved);

  // ── 7. Set the cookie + redirect ──
  // The cookie is HttpOnly (not readable by JS) + SameSite=Lax (sent on
  // top-level navigations). Secure flag added when HTTPS.
  const isHttps = origin?.startsWith('https://') ?? false;
  const res = successRedirect(statePayload.returnPath, origin);
  res.headers.set('Set-Cookie', buildSessionCookieHeader(jwt, isHttps));
  return res;
}
