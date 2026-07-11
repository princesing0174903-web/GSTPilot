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
// On error, redirects to returnPath with ?google_error=... so the UI can
// surface a friendly message.
//
// CRITICAL: The `redirect_uri` passed to `exchangeCodeForTokens` MUST be the
// same URI that was used in `buildAuthUrl` during the connect step. Since
// the callback URL *is* the redirect URI (Google redirected the browser
// here), we resolve it from the request's forwarded headers — exactly the
// same way the connect route does.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  exchangeCodeForTokens,
  storeTokens,
  decodeState,
  resolveRedirectUri,
} from '@/lib/google-workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') ?? '';
  const googleError = url.searchParams.get('error');

  const decoded = decodeState(state);
  const returnPath = decoded?.returnPath ?? '/google-workspace';

  // User denied consent.
  if (googleError) {
    return NextResponse.redirect(
      new URL(`${returnPath}?google_error=${encodeURIComponent(googleError)}`, url.origin),
    );
  }

  if (!code || !decoded) {
    return NextResponse.redirect(
      new URL(`${returnPath}?google_error=${encodeURIComponent('Missing code or invalid state.')}`, url.origin),
    );
  }

  try {
    // The redirect URI for token exchange MUST match the one used in the
    // authorize URL. Resolve it from the request the same way connect does.
    const redirectUri = resolveRedirectUri(req);
    console.info(
      '[/api/integrations/google/callback] redirectUri=',
      redirectUri,
      ' host=',
      req.headers.get('host'),
      ' x-forwarded-host=',
      req.headers.get('x-forwarded-host'),
    );

    const { tokens, userInfo, error } = await exchangeCodeForTokens(code, redirectUri);
    if (error || !tokens.accessToken) {
      return NextResponse.redirect(
        new URL(`${returnPath}?google_error=${encodeURIComponent(error ?? 'No access token returned.')}`, url.origin),
      );
    }

    await storeTokens(
      decoded.orgId,
      decoded.userId,
      decoded.userEmail || userInfo.email || 'unknown@gmail.com',
      userInfo.sub ?? null,
      tokens,
    );

    return NextResponse.redirect(
      new URL(`${returnPath}?google_connected=1`, url.origin),
    );
  } catch (err) {
    console.error('[/api/integrations/google/callback] error:', err);
    return NextResponse.redirect(
      new URL(
        `${returnPath}?google_error=${encodeURIComponent(err instanceof Error ? err.message : 'Callback failed.')}`,
        url.origin,
      ),
    );
  }
}
