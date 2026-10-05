// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/integrations/zoho/payments
// ═══════════════════════════════════════════════════════════════════════════════
// Lists Zoho Books customer payments (most recent first).
//
// Query params:
//   ?max=N    → page size (default 25, capped at 200)
//
// Calls `{apiBaseUrl}/customerpayments?organization_id=<zohoOrgId>` with the
// stored access token. Returns the raw Zoho payments list.
//
// Returns:
//   • 200 { ok: true, data: { payments: [...], count } }
//   • 400 { ok: false, code: 'NO_ORG_SELECTED' } — user hasn't picked a Zoho org yet
//   • 401 { ok: false, code: 'AUTH_REVOKED' }     — refresh token revoked
//   • 503 { ok: false, code: 'AUTH_STALE' }       — temp refresh failure
//   • 502 { ok: false, code: 'ZOHO_API_ERROR' }   — Zoho returned non-2xx
//   • 400 — missing orgId/userId
//   • 401 — auth required (from requireAuth)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership } from "@/lib/auth/session";
import { db } from '@/lib/db';
import {
  getValidAccessToken,
  getApiBaseUrl,
  resolveOrgFromHeaders,
} from '@/lib/integrations/zoho/oauth';
import type { ZohoPayment } from '@/lib/integrations/zoho/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function zohoError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, code, error: message }, { status });
}

export async function GET(req: Request) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgId = resolveOrgFromHeaders(req);
  const userId = authResult.uid;
  const memberResult = await requireOrgMembership(userId, orgId);
  if (memberResult instanceof NextResponse) return memberResult;
  if (!orgId) {
    return zohoError(400, 'NO_ORG_CONTEXT', 'Missing workspace context.');
  }

  const url = new URL(req.url);
  const maxRaw = Number.parseInt(url.searchParams.get('max') ?? '25', 10);
  const max = Number.isFinite(maxRaw) ? Math.min(Math.max(maxRaw, 1), 200) : 25;

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

  const row = await db.zohoBooksToken.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
    select: { apiDomain: true, zohoOrgId: true, zohoOrgName: true },
  });

  if (!row?.zohoOrgId) {
    return zohoError(
      400,
      'NO_ORG_SELECTED',
      'Please select a Zoho Books organization first.'
    );
  }

  const apiBaseUrl = getApiBaseUrl(row.apiDomain);

  try {
    const params = new URLSearchParams({
      organization_id: row.zohoOrgId,
      per_page: String(max),
      sort_column: 'date',
      sort_order: 'D',
    });
    const res = await fetch(
      `${apiBaseUrl}/customerpayments?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
        cache: 'no-store',
      }
    );
    const data = (await res.json().catch(() => ({}))) as {
      payments?: ZohoPayment[];
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

    const payments = data.payments ?? [];
    return NextResponse.json({
      ok: true,
      data: {
        payments,
        organizationName: row.zohoOrgName,
        count: payments.length,
      },
    });
  } catch (e) {
    console.error('[zoho/payments] error:', e);
    return zohoError(500, 'INTERNAL_ERROR', 'Unexpected error.');
  }
}
