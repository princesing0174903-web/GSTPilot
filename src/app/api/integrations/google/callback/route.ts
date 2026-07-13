// ═══════════════════════════════════════════════════════════════════════════════
// /api/integrations/google/callback — Handle the OAuth 2.0 callback
//
// Google redirects here with ?code=...&state=... (or ?error=... on denial).
// This route:
//   1. Decodes the state (orgId, userId, userEmail, returnPath)
//   2. Exchanges the code for access + refresh tokens
//   3. Encrypts + persists the tokens (Prisma GoogleWorkspaceToken)
//   4. Redirects the browser to the ROOT route "/" with ?google_connected=1
//      and ?view=<returnPath-without-leading-slash> so the app shell can
//      switch to the correct client-side view on mount.
//
// CRITICAL — why we redirect to "/" and NOT to returnPath:
// The `returnPath` (e.g. "/google-workspace") is a CLIENT-SIDE VIEW
// identifier, NOT a Next.js route. There is no src/app/google-workspace/page.tsx
// file. Redirecting to `${publicOrigin}/google-workspace` produces a 404.
// The app is a single-page shell at "/" (src/app/page.tsx) that switches
// views via AppContext's in-memory `currentView` state. So we redirect to
// the ROOT route "/" (which always exists) and pass the target view as a
// ?view= query param. AppContext reads ?view= on mount and switches to that
// view, so the GoogleWorkspacePage renders and shows the ?google_connected=1
// success banner.
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

/**
 * Convert a `returnPath` view identifier (e.g. "/google-workspace") into the
 * ROOT route "/" with a `?view=<name>` query param. The returnPath is a
 * CLIENT-SIDE VIEW identifier, NOT a Next.js route — there is no
 * /google-workspace route file. Redirecting there produces a 404. The root
 * route "/" always exists (src/app/page.tsx), and the app shell reads ?view=
 * on mount to switch to the correct view.
 *
 * Returns a URL string like:
 *   "https://preview-chat-xxx.space-z.ai/?google_connected=1&view=google-workspace"
 */
function buildAppRedirectUrl(
  publicOrigin: string,
  returnPath: string,
  params: Record<string, string>,
): string {
  // Extract the view name from the returnPath (strip leading slashes + any query string).
  // e.g. "/google-workspace" → "google-workspace", "" → "google-workspace" (default).
  const viewName =
    returnPath.replace(/^\/+/, '').replace(/[?].*$/, '') || 'google-workspace';
  const url = new URL('/', publicOrigin);
  // Always set the view so the app shell switches to the right client-side view.
  url.searchParams.set('view', viewName);
  // Add the extra params (google_connected=1 or google_error=<msg>).
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
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
    const target = buildAppRedirectUrl(publicOrigin, returnPath, {
      google_error: googleError,
    });
    console.info('[/api/integrations/google/callback] redirect(denied) →', target);
    return NextResponse.redirect(new URL(target));
  }

  if (!code || !decoded) {
    const target = buildAppRedirectUrl(publicOrigin, returnPath, {
      google_error: 'Missing code or invalid state.',
    });
    console.info('[/api/integrations/google/callback] redirect(no-code) →', target);
    return NextResponse.redirect(new URL(target));
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
      const target = buildAppRedirectUrl(publicOrigin, returnPath, {
        google_error: error ?? 'No access token returned.',
      });
      console.info('[/api/integrations/google/callback] redirect(token-failed) →', target);
      return NextResponse.redirect(new URL(target));
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

    // SUCCESS — redirect to the ROOT route "/" (always exists) with
    // ?google_connected=1&view=google-workspace. The app shell (AppContext)
    // reads ?view= on mount and switches to the google-workspace view, so
    // GoogleWorkspacePage renders and shows the success banner.
    const target = buildAppRedirectUrl(publicOrigin, returnPath, {
      google_connected: '1',
    });
    console.info(
      '[/api/integrations/google/callback] redirect(success) publicOrigin=',
      publicOrigin,
      'returnPath=',
      returnPath,
      '→',
      target,
    );
    return NextResponse.redirect(new URL(target));
  } catch (err) {
    console.error('[/api/integrations/google/callback] error:', err);
    const target = buildAppRedirectUrl(publicOrigin, returnPath, {
      google_error: err instanceof Error ? err.message : 'Callback failed.',
    });
    console.info('[/api/integrations/google/callback] redirect(exception) →', target);
    return NextResponse.redirect(new URL(target));
  }
}
