// ═══════════════════════════════════════════════════════════════════════════════
// /api/integrations/google/callback — Handle the OAuth 2.0 callback
//
// Google redirects here with ?code=...&state=... (or ?error=... on denial).
// This route:
//   1. Decodes the state (orgId, userId, userEmail, returnPath)
//   2. Exchanges the code for access + refresh tokens
//   3. Encrypts + persists the tokens (Prisma GoogleWorkspaceToken)
//   4. Redirects the browser to returnPath with a success flag
//
// CRITICAL: The `redirect_uri` passed to `exchangeCodeForTokens` MUST be the
// same URI that was used in `buildAuthUrl` during the connect step. Since
// the callback URL *is* the redirect URI (Google redirected the browser
// here), we resolve it from the request's forwarded headers — exactly the
// same way the connect route does. Because the callback request comes from
// the same browser that did the authorize step (same origin), the two URIs
// are guaranteed to match.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  exchangeCodeForTokens,
  storeTokens,
  decodeState,
  resolveRedirectUri,
} from '@/lib/google-workspace';

/**
 * Derive the public origin (scheme://host) from a redirect URI by stripping
 * the `/api/integrations/google/callback` path. Falls back to the request's
 * resolved origin if the redirect URI is missing or malformed.
 */
function originFromRedirectUri(redirectUri: string | undefined, req: Request): string {
  if (redirectUri) {
    try {
      const parsed = new URL(redirectUri);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      /* ignore */
    }
  }
  // Fallback: resolve from request (may be stale if gateway overwrote headers)
  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return 'http://localhost:3000';
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') ?? '';
  const googleError = url.searchParams.get('error');

  const decoded = decodeState(state);
  const returnPath = decoded?.returnPath ?? '/google-workspace';

  // Derive the REAL public origin from the state's redirectUri (set by the
  // connect step from the browser's Origin header). This is the origin the
  // user's browser is actually browsing — NOT the stale internal hostname the
  // gateway may have put in Host/X-Forwarded-Host. Used for all browser
  // redirects so the user lands back on the real preview URL.
  const publicOrigin = originFromRedirectUri(decoded?.redirectUri, req);

  // User denied consent.
  if (googleError) {
    return NextResponse.redirect(
      new URL(`${returnPath}?google_error=${encodeURIComponent(googleError)}`, publicOrigin),
    );
  }

  if (!code || !decoded) {
    return NextResponse.redirect(
      new URL(`${returnPath}?google_error=${encodeURIComponent('Missing code or invalid state.')}`, publicOrigin),
    );
  }

  try {
    // The redirect URI for token exchange MUST match the one used in the
    // authorize URL. We prefer the redirectUri encoded in the state (set by
    // the connect step from the browser's Origin header) because the callback
    // is a browser NAVIGATION from Google — it has no Origin header, and the
    // gateway may have overwritten Host/X-Forwarded-Host with a stale internal
    // hostname. Falling back to resolveRedirectUri(req) handles the case where
    // state doesn't contain redirectUri (backward compat with old states).
    const redirectUri = decoded.redirectUri ?? resolveRedirectUri(req);
    console.info(
      '[/api/integrations/google/callback] redirectUri=',
      redirectUri,
      ' stateRedirectUri=',
      decoded.redirectUri ?? '(not in state)',
      ' host=',
      req.headers.get('host'),
      ' x-forwarded-host=',
      req.headers.get('x-forwarded-host'),
      ' origin=',
      req.headers.get('origin'),
    );

    const { tokens, userInfo, error } = await exchangeCodeForTokens(code, redirectUri);
    if (error || !tokens.accessToken) {
      console.error('[/api/integrations/google/callback] token exchange failed:', error);
      return NextResponse.redirect(
        new URL(`${returnPath}?google_error=${encodeURIComponent(error ?? 'No access token returned.')}`, publicOrigin),
      );
    }

    await storeTokens(
      decoded.orgId,
      decoded.userId,
      decoded.userEmail || userInfo.email || 'unknown@gmail.com',
      userInfo.sub ?? null,
      tokens,
    );

    console.info(
      '[/api/integrations/google/callback] tokens stored for orgId=',
      decoded.orgId,
      'userId=',
      decoded.userId,
      'googleUser=',
      userInfo.email,
    );

    return NextResponse.redirect(
      new URL(`${returnPath}?google_connected=1`, publicOrigin),
    );
  } catch (err) {
    console.error('[/api/integrations/google/callback] error:', err);
    return NextResponse.redirect(
      new URL(
        `${returnPath}?google_error=${encodeURIComponent(err instanceof Error ? err.message : 'Callback failed.')}`,
        publicOrigin,
      ),
    );
  }
}
