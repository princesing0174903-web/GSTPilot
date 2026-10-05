// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/integrations/zoho/connect
// ═══════════════════════════════════════════════════════════════════════════════
// Initiates the Zoho Books OAuth flow.
//
//   1. requireAuth → resolves the caller's identity.
//   2. resolveOrgFromHeaders → reads (orgId, userId) from the
//      `x-gstpilot-orgid` + `x-gstpilot-actor` headers.
//   3. getZohoOAuthConfig → returns {clientId, clientSecret, redirectUri,
//      endpoints}. The redirect URI comes from ZOHO_REDIRECT_URI env var
//      (NOT dynamically resolved — Zoho requires pre-registration).
//   4. encodeState → HMAC-signed state carrying (orgId, userId, email,
//      returnPath, redirectUri) with a 16-byte nonce + 10-min TTL.
//   5. buildAuthUrl → Zoho consent URL.
//
// Returns:
//   • 200 { ok, authUrl, redirectUri }   — caller redirects the browser to
//     `authUrl`; Zoho will redirect back to `redirectUri?code=...&state=...`.
//   • 503 { error, code: 'ZOHO_NOT_CONFIGURED', requiredEnvVars }
//     — ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET / ZOHO_REDIRECT_URI missing.
//   • 401 — auth required (from requireAuth).
//   • 400 — missing orgId or userId headers.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership } from "@/lib/auth/session";
import {
  isZohoConfigured,
  getZohoOAuthConfig,
  
  encodeState,
  buildAuthUrl,
} from '@/lib/integrations/zoho/oauth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  // ── Auth ──
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid, email } = authResult;

  // ── Configuration check ──
  if (!isZohoConfigured() || !process.env.ZOHO_REDIRECT_URI) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Zoho Books OAuth is not configured on this server.',
        code: 'ZOHO_NOT_CONFIGURED',
        requiredEnvVars: [
          'ZOHO_CLIENT_ID',
          'ZOHO_CLIENT_SECRET',
          'ZOHO_REDIRECT_URI',
        ],
      },
      { status: 503 }
    );
  }

  // ── Org + user resolution ──
  const orgId = req.headers.get('x-gstpilot-orgid');
  const userId = authResult.uid;
  const memberResult = await requireOrgMembership(userId, orgId);
  if (memberResult instanceof NextResponse) return memberResult;
  if (!orgId) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Missing workspace context. Please refresh the page and try again.',
        code: 'NO_ORG_CONTEXT',
      },
      { status: 400 }
    );
  }

  // Prefer the header-supplied uid (consistent with every other route in this
  // codebase).
  const effectiveUserId = userId || uid;
  const effectiveEmail = email;

  // ── Get OAuth config (throws if env missing — but we checked above) ──
  const cfg = getZohoOAuthConfig();
  const redirectUri = cfg.redirectUri;

  // ── Build HMAC-signed state ──
  const state = encodeState({
    orgId,
    userId: effectiveUserId,
    userEmail: effectiveEmail,
    returnPath: '/?view=zoho-books',
    redirectUri,
  });

  // ── Build the Zoho consent URL ──
  const authUrl = buildAuthUrl(state, redirectUri);

  return NextResponse.json({
    ok: true,
    authUrl,
    redirectUri,
  });
}
