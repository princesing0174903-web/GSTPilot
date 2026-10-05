// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/integrations/zoho/organizations
// ═══════════════════════════════════════════════════════════════════════════════
// Lists the Zoho Books organizations the connected user has access to.
//
// Calls `{apiBaseUrl}/organizations` (e.g. https://www.zohoapis.in/books/v3/organizations)
// with the stored access token (refreshed if needed). Returns the raw Zoho
// organization list so the UI can render a selector.
//
// Returns:
//   • 200 { ok: true, data: { organizations: [...], selectedOrgId, count } }
//   • 401 { ok: false, code: 'AUTH_REVOKED' }  — refresh token revoked
//   • 503 { ok: false, code: 'AUTH_STALE' }    — temp refresh failure
//   • 502 { ok: false, code: 'ZOHO_API_ERROR' } — Zoho returned non-2xx
//   • 400 — missing orgId/userId
//   • 401 — auth required (from requireAuth)
//
// The Zoho access token NEVER leaves the server — only the proxied list is
// returned to the client.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership } from "@/lib/auth/session";
import { db } from '@/lib/db';
import {
  getValidAccessToken,
  getApiBaseUrl,
  
} from '@/lib/integrations/zoho/oauth';
import type { ZohoOrganization } from '@/lib/integrations/zoho/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function zohoError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, code, error: message }, { status });
}

export async function GET(req: Request) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgId = req.headers.get('x-gstpilot-orgid');
  const userId = authResult.uid;
  const memberResult = await requireOrgMembership(userId, orgId);
  if (memberResult instanceof NextResponse) return memberResult;
  if (!orgId) {
    return zohoError(400, 'NO_ORG_CONTEXT', 'Missing workspace context.');
  }

  const tokenResult = await getValidAccessToken(orgId, userId);
  if (!tokenResult.accessToken) {
    if (tokenResult.permanent) {
      return zohoError(401, 'AUTH_REVOKED', 'Zoho access was revoked. Please reconnect.');
    }
    return zohoError(
      503,
      'AUTH_STALE',
      'Temporarily unable to reach Zoho. Please retry in a moment.'
    );
  }

  // Load the row to get the stored api_domain (Zoho may have moved us to a
  // different DC) + the currently selected org.
  const row = await db.zohoBooksToken.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
    select: { apiDomain: true, zohoOrgId: true },
  });
  const apiBaseUrl = getApiBaseUrl(row?.apiDomain);

  try {
    const url = `${apiBaseUrl}/organizations`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
      cache: 'no-store',
    });
    const data = (await res.json().catch(() => ({}))) as {
      organizations?: ZohoOrganization[];
      code?: number;
      message?: string;
    };
    if (!res.ok) {
      return zohoError(
        502,
        'ZOHO_API_ERROR',
        data.message ?? `Zoho API returned HTTP ${res.status}.`
      );
    }

    const organizations = data.organizations ?? [];
    return NextResponse.json({
      ok: true,
      data: {
        organizations,
        selectedOrgId: row?.zohoOrgId ?? null,
        count: organizations.length,
      },
    });
  } catch (e) {
    console.error('[zoho/organizations] error:', e);
    return zohoError(500, 'INTERNAL_ERROR', 'Unexpected error.');
  }
}
