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

/**
 * Detect whether the Zoho OAuth client credentials are configured in the
 * environment. When they aren't, we return a structured `ZOHO_NOT_CONFIGURED`
 * payload so the UI can show an honest "Configuration required" state instead
 * of a misleading connection failure.
 */
function isZohoConfigured(): boolean {
  return Boolean(process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET);
}

export async function GET(req: Request) {
  const stage = 'connect';
  try {
    // ─── STAGE 1: Auth context ───
    const { orgId, userId, userEmail } = resolveOrgUserFromHeaders(req);
    if (!orgId || !userId) {
      console.warn(`[zoho/${stage}] FAIL: missing org/user headers`);
      return NextResponse.json(
        { ok: false, error: 'Organization + user context required.' },
        { status: 400 },
      );
    }

    // ─── STAGE 2: Configuration check ───
    if (!isZohoConfigured()) {
      console.warn(`[zoho/${stage}] FAIL: ZOHO_NOT_CONFIGURED (org=${orgId})`);
      return NextResponse.json(
        {
          ok: false,
          error:
            'Zoho Books OAuth is not configured on this server. An administrator must set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET (and optionally ZOHO_DC, ZOHO_REDIRECT_URI) before you can connect.',
          code: 'ZOHO_NOT_CONFIGURED',
          requiresConfig: true,
          requiredEnvVars: [
            'ZOHO_CLIENT_ID',
            'ZOHO_CLIENT_SECRET',
            'ZOHO_DC',
            'ZOHO_REDIRECT_URI',
          ],
        },
        { status: 503 },
      );
    }

    // ─── STAGE 3: Build redirect URI + state ───
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

    // Diagnostic log (NO secrets — only public OAuth params).
    console.info(
      `[zoho/${stage}] OK: org=${orgId} user=${userId} redirectUri=${redirectUri} ` +
        `host=${req.headers.get('host') ?? 'none'} ` +
        `x-forwarded-host=${req.headers.get('x-forwarded-host') ?? 'none'} ` +
        `abc=${req.headers.get('abc') ? 'present' : 'none'} ` +
        `dc=${process.env.ZOHO_DC ?? 'in'}`,
    );

    return NextResponse.json({ ok: true, authUrl, redirectUri });
  } catch (err) {
    console.error(`[zoho/${stage}] UNEXPECTED ERROR:`, err);
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
