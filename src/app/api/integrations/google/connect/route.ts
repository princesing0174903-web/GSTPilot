// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/integrations/google/connect
// ═══════════════════════════════════════════════════════════════════════════════
// Initiates the Google Workspace OAuth flow.
//
//   1. requireAuth → resolves the caller's identity (Bearer token or
//      x-gstpilot-actor header fallback).
//   2. resolveOrgUserFromHeaders → reads (orgId, userId) from the
//      `x-gstpilot-orgid` + `x-gstpilot-actor` headers stamped by the client.
//   3. resolveRedirectUri → 7-step fallback for the OAuth redirect URI.
//   4. encodeState → HMAC-signed state carrying (orgId, userId, email,
//      returnPath, redirectUri) with a 16-byte nonce + 10-min TTL.
//   5. buildAuthUrl → Google consent URL.
//
// Returns:
//   • 200 { ok, authUrl, redirectUri }   — caller redirects the browser to
//     `authUrl`; Google will redirect back to `redirectUri?code=...&state=...`.
//   • 503 { error, code: 'GOOGLE_NOT_CONFIGURED', requiredEnvVars }
//     — GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing from env.
//   • 401 — auth required (from requireAuth).
//   • 400 — missing orgId or userId headers.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import {
  isGoogleConfigured,
  resolveRedirectUri,
  resolveOrgUserFromHeaders,
  encodeState,
  buildAuthUrl,
} from '@/lib/integrations/google/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  // ── Auth ──
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid, email } = authResult;

  // ── Configuration check ──
  if (!isGoogleConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Google Workspace OAuth is not configured on this server.',
        code: 'GOOGLE_NOT_CONFIGURED',
        requiredEnvVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
      },
      { status: 503 }
    );
  }

  // ── Org + user resolution (from headers — same source of truth as every
  //    other route in this codebase) ──
  const { orgId, userId } = resolveOrgUserFromHeaders(req);
  if (!orgId || !userId) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Missing workspace context. Please refresh the page and try again.',
        code: 'NO_ORG_CONTEXT',
      },
      { status: 400 }
    );
  }

  // Prefer the header-supplied uid (the caller may be acting on behalf of a
  // different user in rare admin contexts — match the established pattern).
  const effectiveUserId = userId || uid;
  const effectiveEmail = email;

  // ── Resolve redirect URI from the incoming request ──
  const redirectUri = resolveRedirectUri(req);

  // ── Build HMAC-signed state ──
  const state = encodeState({
    orgId,
    userId: effectiveUserId,
    userEmail: effectiveEmail,
    returnPath: '/?view=google-workspace',
    redirectUri,
  });

  // ── Build the Google consent URL ──
  const authUrl = buildAuthUrl(state, redirectUri);

  return NextResponse.json({
    ok: true,
    authUrl,
    redirectUri,
  });
}
