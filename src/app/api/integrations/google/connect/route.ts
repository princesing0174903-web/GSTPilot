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
// The `redirect_uri` is derived PER REQUEST from the request's forwarded
// headers via `resolveRedirectUri(req)`:
//   • Browsing http://localhost:3000  → http://localhost:3000/api/integrations/google/callback
//   • Browsing https://*.fcapp.run    → https://*.fcapp.run/api/integrations/google/callback
//
// HTTPS is inferred for any non-localhost host (the fcapp.run edge proxy
// terminates TLS; Caddy overwrites X-Forwarded-Proto to http, so we can't
// trust it for real domains). Google requires HTTPS for non-localhost
// redirect URIs, so this inference is also a Google requirement.
//
// The callback route uses the same resolution logic, so the redirect_uri
// sent to Google here exactly matches the one sent in the token-exchange
// step (Google rejects mismatches with `redirect_uri_mismatch`).
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
    const redirectUri = resolveRedirectUri(req);

    const state = encodeState({ orgId, userId, userEmail: userEmail ?? '', returnPath, redirectUri });
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
