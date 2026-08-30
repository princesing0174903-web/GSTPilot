// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/integrations/google/callback
// ═══════════════════════════════════════════════════════════════════════════════
// Google's OAuth redirect target. After the user consents on Google's consent
// page, Google redirects here with `?code=...&state=...` (or `?error=...`).
//
//   1. Parse `code` + `state` from the query string.
//   2. decodeState → verifies HMAC + TTL + nonce echo.
//   3. exchangeCodeForTokens → calls Google's token endpoint with the code
//      + the SAME redirect_uri that was used to build the auth URL (stored in
//      the signed state — required so Google's check matches).
//   4. storeTokens → AES-256-GCM encrypt + upsert to GoogleWorkspaceToken.
//   5. Redirect to `/?google_connected=1&view=google-workspace` on success,
//      or `/?google_error=<code>` on failure.
//
// SECURITY:
//   • The state HMAC + TTL + nonce guarantee the request came from OUR connect
//     endpoint (not a CSRF), and is no older than 10 minutes.
//   • The redirect_uri passed to Google's token endpoint is taken from the
//     signed state — an attacker can't substitute their own.
//   • No tokens are returned to the browser — the user is redirected to the
//     app's home page with only a success/error flag in the URL.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  decodeState,
  exchangeCodeForTokens,
  storeTokens,
} from '@/lib/integrations/google/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function failRedirect(code: string): NextResponse {
  const url = `/?google_error=${encodeURIComponent(code)}&view=google-workspace`;
  return NextResponse.redirect(new URL(url, 'http://localhost:3000'));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const googleError = url.searchParams.get('error');

  // User declined consent on Google's page.
  if (googleError) {
    return failRedirect(`google_${googleError}`);
  }
  if (!code || !stateParam) {
    return failRedirect('missing_params');
  }

  // ── Verify state ──
  const state = decodeState(stateParam);
  if (!state) {
    return failRedirect('invalid_state');
  }

  // ── Exchange code for tokens (uses the redirect_uri from the signed state
  //    so Google's check matches the one used to build the auth URL) ──
  const exchange = await exchangeCodeForTokens(code, state.redirectUri);
  if (exchange.error || !exchange.tokens?.access_token) {
    return failRedirect('exchange_failed');
  }

  // ── Persist tokens (AES-256-GCM) ──
  try {
    await storeTokens(
      state.orgId,
      state.userId,
      state.userEmail ?? exchange.userInfo?.email ?? '',
      exchange.userInfo?.sub ?? null,
      {
        access_token: exchange.tokens.access_token,
        refresh_token: exchange.tokens.refresh_token,
        expires_in: exchange.tokens.expires_in,
        expiry_date: exchange.tokens.expiry_date,
        scope: exchange.tokens.scope,
        token_type: exchange.tokens.token_type,
      }
    );
  } catch (e) {
    console.error('[google/callback] storeTokens failed:', e);
    return failRedirect('persistence_failed');
  }

  // ── Redirect back to the app ──
  const returnPath = state.returnPath ?? '/?view=google-workspace';
  const sep = returnPath.includes('?') ? '&' : '?';
  const finalUrl = `${returnPath}${sep}google_connected=1`;
  return NextResponse.redirect(new URL(finalUrl, 'http://localhost:3000'));
}
