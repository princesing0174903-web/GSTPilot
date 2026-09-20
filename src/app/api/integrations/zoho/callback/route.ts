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

/**
 * Detect the app origin from the incoming request so redirects land on the
 * correct domain (preview OR localhost). Mirrors the Google + GitHub callback
 * detectOrigin logic. Prefers ZOHO_REDIRECT_URI's origin (set in .env to the
 * preview URL), then falls back to request headers.
 */
function detectOrigin(req: Request): string {
  // 1. Env var (preferred — set to the preview URL in .env)
  const envUri = process.env.ZOHO_REDIRECT_URI;
  if (envUri) {
    try {
      return new URL(envUri).origin;
    } catch {
      // fall through
    }
  }
  // 2. abc header (preview gateway marker)
  const url = new URL(req.url);
  const abc = req.headers.get('abc');
  if (abc) {
    const proto = url.protocol.replace(':', '');
    return `${proto}://${abc}`;
  }
  // 3. Origin header
  const origin = req.headers.get('origin');
  if (origin) return origin;
  // 4. X-Forwarded-Host + X-Forwarded-Proto
  const fwdHost = req.headers.get('x-forwarded-host');
  const fwdProto = req.headers.get('x-forwarded-proto');
  if (fwdHost) {
    return `${fwdProto ?? 'https'}://${fwdHost}`;
  }
  // 5. Host header (proto inferred from localhost)
  const host = req.headers.get('host');
  if (host) {
    const isLocal = host.startsWith('localhost') || host.startsWith('127.');
    return `${isLocal ? 'http' : 'https'}://${host}`;
  }
  // 6. req.url origin
  return `${url.protocol}//${url.host}`;
}

function failRedirect(req: Request, code: string): NextResponse {
  const url = `/?zoho_error=${encodeURIComponent(code)}&view=zoho-books`;
  return NextResponse.redirect(new URL(url, detectOrigin(req)));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const zohoError = url.searchParams.get('error');

  // User declined consent on Zoho's page.
  if (zohoError) {
    return failRedirect(req, `zoho_${zohoError}`);
  }
  if (!code || !stateParam) {
    return failRedirect(req, 'missing_params');
  }

  // ── Verify state ──
  const state = decodeState(stateParam);
  if (!state) {
    return failRedirect(req, 'invalid_state');
  }

  // ── Exchange code for tokens (uses the redirect_uri from the signed state) ──
  const exchange = await exchangeCodeForTokens(code, state.redirectUri);
  if (exchange.error || !exchange.tokens?.access_token) {
    console.error('[zoho/callback] exchange failed:', exchange.error);
    return failRedirect(req, 'exchange_failed');
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
    return failRedirect(req, 'persistence_failed');
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

  // ── Redirect back to the app (origin detected from request, NOT hardcoded localhost) ──
  const returnPath = state.returnPath ?? '/?view=zoho-books';
  const sep = returnPath.includes('?') ? '&' : '?';
  const finalUrl = `${returnPath}${sep}zoho_connected=1`;
  return NextResponse.redirect(new URL(finalUrl, detectOrigin(req)));
}
