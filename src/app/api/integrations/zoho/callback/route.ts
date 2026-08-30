// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/integrations/zoho/callback
// ═══════════════════════════════════════════════════════════════════════════════
// Zoho's OAuth redirect target. After the user consents on Zoho's consent
// page, Zoho redirects here with `?code=...&state=...` (or `?error=...`).
//
//   1. Parse `code` + `state` from the query string.
//   2. decodeState → verifies HMAC + TTL + nonce echo.
//   3. exchangeCodeForTokens → calls Zoho's token endpoint with the code
//      + the SAME redirect_uri that was used to build the auth URL (stored in
//      the signed state — required so Zoho's check matches).
//   4. storeTokens → AES-256-GCM encrypt + upsert to ZohoBooksToken.
//   5. refreshOrganizationMapping → fetch the user's Zoho organizations list
//      + persist the default org's ID + name on the token row.
//   6. Redirect to `/?zoho_connected=1&view=zoho-books` on success,
//      or `/?zoho_error=<code>` on failure.
//
// SECURITY:
//   • The state HMAC + TTL + nonce guarantee the request came from OUR connect
//     endpoint (not a CSRF), and is no older than 10 minutes.
//   • The redirect_uri passed to Zoho's token endpoint is taken from the
//     signed state — an attacker can't substitute their own.
//   • No tokens are returned to the browser — the user is redirected to the
//     app's home page with only a success/error flag in the URL.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  decodeState,
  exchangeCodeForTokens,
  storeTokens,
  getValidAccessToken,
  refreshOrganizationMapping,
} from '@/lib/integrations/zoho/oauth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function failRedirect(code: string): NextResponse {
  const url = `/?zoho_error=${encodeURIComponent(code)}&view=zoho-books`;
  return NextResponse.redirect(new URL(url, 'http://localhost:3000'));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const zohoError = url.searchParams.get('error');

  // User declined consent on Zoho's page.
  if (zohoError) {
    return failRedirect(`zoho_${zohoError}`);
  }
  if (!code || !stateParam) {
    return failRedirect('missing_params');
  }

  // ── Verify state ──
  const state = decodeState(stateParam);
  if (!state) {
    return failRedirect('invalid_state');
  }

  // ── Exchange code for tokens (uses the redirect_uri from the signed state) ──
  const exchange = await exchangeCodeForTokens(code, state.redirectUri);
  if (exchange.error || !exchange.tokens?.access_token) {
    console.error('[zoho/callback] exchange failed:', exchange.error);
    return failRedirect('exchange_failed');
  }

  // ── Persist tokens (AES-256-GCM) ──
  try {
    await storeTokens(
      state.orgId,
      state.userId,
      state.userEmail ?? '',
      {
        access_token: exchange.tokens.access_token,
        refresh_token: exchange.tokens.refresh_token,
        expires_in: exchange.tokens.expires_in,
        api_domain: exchange.tokens.api_domain,
        scope: exchange.tokens.scope,
        token_type: exchange.tokens.token_type,
      }
    );
  } catch (e) {
    console.error('[zoho/callback] storeTokens failed:', e);
    return failRedirect('persistence_failed');
  }

  // ── Fetch organizations + persist the default org mapping ──
  // Best-effort — failures don't fail the connection itself (the user can
  // pick the org later via the selector).
  try {
    const tokenResult = await getValidAccessToken(state.orgId, state.userId);
    if (tokenResult.accessToken) {
      await refreshOrganizationMapping(
        state.orgId,
        state.userId,
        tokenResult.accessToken
      );
    }
  } catch (e) {
    console.warn('[zoho/callback] org mapping failed:', (e as Error).message);
    // Non-fatal.
  }

  // ── Redirect back to the app ──
  const returnPath = state.returnPath ?? '/?view=zoho-books';
  const sep = returnPath.includes('?') ? '&' : '?';
  const finalUrl = `${returnPath}${sep}zoho_connected=1`;
  return NextResponse.redirect(new URL(finalUrl, 'http://localhost:3000'));
}
