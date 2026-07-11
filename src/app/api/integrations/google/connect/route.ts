// ═══════════════════════════════════════════════════════════════════════════════
// /api/integrations/google/connect — Start the Google OAuth 2.0 flow
//
// GET /api/integrations/google/connect?return=/settings
//   Reads orgId + actor from request headers, builds the Google consent URL,
//   and returns it as JSON (the client does a window.location redirect).
//
// Headers:
//   x-gstpilot-orgid:   <orgId>
//   x-gstpilot-actor:   { uid, email }   (JSON)
//
// Response: { ok: true, authUrl: string, redirectUri: string }
//
// The `redirect_uri` embedded in `authUrl` is derived PER REQUEST from the
// request's forwarded headers (X-Forwarded-Host / X-Forwarded-Proto set by
// the Caddy gateway). This is critical because Google redirects the user's
// BROWSER (not the server) to the callback URL — so the URL MUST be reachable
// by the browser:
//   • Browsing localhost:3000  → redirect_uri = http://localhost:3000/...
//   • Browsing preview URL     → redirect_uri = http://<preview-host>/...
//
// The callback route uses the same resolution logic, so the redirect_uri
// sent to Google here exactly matches the one sent in the token-exchange
// step (Google rejects mismatches with `redirect_uri_mismatch`).
//
// IMPORTANT: every distinct redirect URI must be registered in Google Cloud
// Console → Credentials → OAuth 2.0 Client → "Authorized redirect URIs".
// Use /api/integrations/google/redirect-uri to see the exact URI for the
// current request.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  buildAuthUrl,
  encodeState,
  resolveOrgUserFromHeaders,
  resolveRedirectUri,
} from '@/lib/google-workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { orgId, userId, userEmail } = resolveOrgUserFromHeaders(req);
    if (!orgId || !userId) {
      return NextResponse.json(
        { ok: false, error: 'Organization + user context required.' },
        { status: 400 },
      );
    }

    const url = new URL(req.url);
    const returnPath = url.searchParams.get('return') ?? '/google-workspace';

    // Derive the OAuth redirect URI from the request's actual public origin.
    // This MUST match what's registered in Google Cloud Console → Credentials →
    // OAuth 2.0 Client → "Authorized redirect URIs".
    const redirectUri = resolveRedirectUri(req);

    const state = encodeState({ orgId, userId, userEmail: userEmail ?? '', returnPath });
    const authUrl = buildAuthUrl(state, redirectUri);

    console.info(
      '[/api/integrations/google/connect] redirectUri=',
      redirectUri,
      ' host=',
      req.headers.get('host'),
      ' x-forwarded-host=',
      req.headers.get('x-forwarded-host'),
      ' x-forwarded-proto=',
      req.headers.get('x-forwarded-proto'),
    );

    return NextResponse.json({ ok: true, authUrl, redirectUri });
  } catch (err) {
    console.error('[/api/integrations/google/connect] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to start OAuth flow.' },
      { status: 500 },
    );
  }
}
