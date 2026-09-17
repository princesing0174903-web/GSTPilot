// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/auth/github/authorize
// ═══════════════════════════════════════════════════════════════════════════════
//
// Returns the GitHub OAuth consent URL. The frontend redirects the browser
// to this URL (NOT a popup — popups are blocked inside iframes).
//
// FLOW:
//   1. Verify GitHub OAuth is configured (env vars present).
//   2. Resolve the runtime redirect URI (preview-aware — matches what's
//      registered in the GitHub App).
//   3. Encode the OAuth state (HMAC-signed, 10-min TTL, nonce echo).
//   4. Build the GitHub consent URL with `read:user user:email` scope.
//   5. Return { ok, authUrl } — the frontend does `window.location.href = authUrl`.
//
// SECURITY:
//   • The state HMAC + nonce echo guarantees the callback came from this
//     authorize endpoint (CSRF defense).
//   • The redirect_uri is stored in the signed state — GitHub's check on
//     callback must match exactly.
//   • The client_secret is NEVER sent to the browser.
//   • No tokens are returned — only the consent URL.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  isGitHubConfigured,
  buildAuthUrl,
  encodeState,
  resolveRedirectUri,
} from '@/lib/integrations/github/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  // ── 1. Configuration check ──
  if (!isGitHubConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: 'GitHub Sign-In is not configured on this server.',
        code: 'GITHUB_NOT_CONFIGURED',
        requiredEnvVars: ['GITHUB_APP_CLIENT_ID', 'GITHUB_APP_CLIENT_SECRET'],
      },
      { status: 503 }
    );
  }

  // ── 2. Resolve redirect URI (preview-aware) ──
  const redirectUri = resolveRedirectUri(req);

  // ── 3. Encode OAuth state (CSRF + login-injection defense) ──
  const url = new URL(req.url);
  const returnPath = url.searchParams.get('return') ?? '/';
  const state = encodeState({
    returnPath,
    redirectUri,
  });

  // ── 4. Build the GitHub consent URL ──
  const authUrl = buildAuthUrl(state, redirectUri);

  return NextResponse.json({
    ok: true,
    authUrl,
    redirectUri, // returned for the GitHub App setup hint (not used by the browser)
  });
}
