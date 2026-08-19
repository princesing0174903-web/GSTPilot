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
  isGoogleConfigured,
  resolveOrgUserFromHeaders,
  resolveRedirectUri,
} from '@/lib/google-workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Detect whether the Google OAuth client credentials are configured in the
 * environment. When they aren't, we return a structured `GOOGLE_NOT_CONFIGURED`
 * payload so the UI can show an honest "Configuration required" state instead
 * of a misleading connection failure.
 */

export async function GET(req: Request) {
  const stage = 'connect';
  try {
    // ─── STAGE 1: Auth context ───
    const { orgId, userId, userEmail } = resolveOrgUserFromHeaders(req);
    if (!orgId || !userId) {
      console.warn(`[google/${stage}] FAIL: missing org/user headers`);
      return NextResponse.json(
        { ok: false, error: 'Organization + user context required.' },
        { status: 400 },
      );
    }

    // ─── STAGE 2: Configuration check ───
    if (!isGoogleConfigured()) {
      console.warn(`[google/${stage}] FAIL: GOOGLE_NOT_CONFIGURED (org=${orgId})`);
      return NextResponse.json(
        {
          ok: false,
          error:
            'Google Workspace OAuth is not configured on this server. An administrator must set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (and optionally GOOGLE_REDIRECT_URI) before you can connect.',
          code: 'GOOGLE_NOT_CONFIGURED',
          requiresConfig: true,
          requiredEnvVars: [
            'GOOGLE_CLIENT_ID',
            'GOOGLE_CLIENT_SECRET',
            'GOOGLE_REDIRECT_URI',
          ],
        },
        { status: 503 },
      );
    }

    // ─── STAGE 3: Build redirect URI + state ───
    const url = new URL(req.url);
    const returnPath = url.searchParams.get('return') ?? '/google-workspace';

    // Derive the OAuth redirect URI from the request's actual public origin.
    const redirectUri = resolveRedirectUri(req);

    const state = encodeState({ orgId, userId, userEmail: userEmail ?? '', returnPath, redirectUri });
    const authUrl = buildAuthUrl(state, redirectUri);

    console.info(
      `[google/${stage}] OK: org=${orgId} user=${userId} redirectUri=${redirectUri} ` +
        `host=${req.headers.get('host') ?? 'none'} ` +
        `x-forwarded-host=${req.headers.get('x-forwarded-host') ?? 'none'} ` +
        `abc=${req.headers.get('abc') ? 'present' : 'none'}`,
    );

    return NextResponse.json({ ok: true, authUrl, redirectUri });
  } catch (err) {
    console.error(`[google/${stage}] UNEXPECTED ERROR:`, err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to start OAuth flow.',
        stage,
      },
      { status: 500 },
    );
  }
}
