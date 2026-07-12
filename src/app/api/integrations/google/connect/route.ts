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
// The `redirect_uri` is always `GOOGLE_REDIRECT_URI` from the environment
// (localhost for local dev, deployment URL for production). Strategy per the
// product roadmap: develop with localhost, deploy to a stable HTTPS domain,
// then register the production redirect URI in Google Cloud Console.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { buildAuthUrl, encodeState, resolveOrgUserFromHeaders, getRedirectUri } from '@/lib/google-workspace';

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

    const state = encodeState({ orgId, userId, userEmail: userEmail ?? '', returnPath });
    const authUrl = buildAuthUrl(state);
    const redirectUri = getRedirectUri();

    return NextResponse.json({ ok: true, authUrl, redirectUri });
  } catch (err) {
    console.error('[/api/integrations/google/connect] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to start OAuth flow.' },
      { status: 500 },
    );
  }
}
