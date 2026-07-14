// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/integrations/zoho/connect
//
// Starts the Zoho Books OAuth 2.0 Authorization Code flow.
//
// Reads org + user context from the `x-gstpilot-orgid` and `x-gstpilot-actor`
// request headers (set by the dashboard shell), builds the Zoho consent-screen
// URL with the ZohoBooks.fullaccess.all scope, and returns it as JSON. The
// client then redirects to that URL via `window.location.href = authUrl`.
//
// The redirect_uri is resolved per-request via `resolveRedirectUri(req)` so it
// works behind the gateway / on preview URLs.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  buildAuthUrl,
  encodeState,
  resolveOrgUserFromHeaders,
  resolveRedirectUri,
} from '@/lib/integrations/zoho-books';

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
    const returnPath = url.searchParams.get('return') ?? '/zoho-books';

    const redirectUri = resolveRedirectUri(req);

    const state = encodeState({
      orgId,
      userId,
      userEmail: userEmail ?? '',
      returnPath,
      redirectUri,
    });
    const authUrl = buildAuthUrl(state, redirectUri);

    console.info(
      '[/api/integrations/zoho/connect] redirectUri=',
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
    console.error('[/api/integrations/zoho/connect] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to start OAuth flow.' },
      { status: 500 },
    );
  }
}
