// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/integrations/zoho/invoices
// ═══════════════════════════════════════════════════════════════════════════════
// Lists Zoho Books invoices (most recent first).
//
// Query params:
//   ?max=N    → page size (default 25, capped at 200)
//
// Calls `{apiBaseUrl}/invoices?organization_id=<zohoOrgId>` with the stored
// access token. Returns the raw Zoho invoices list.
//
// Returns:
//   • 200 { ok: true, data: { invoices: [...], count } }
//   • 400 { ok: false, code: 'NO_ORG_SELECTED' } — user hasn't picked a Zoho org yet
//   • 401 { ok: false, code: 'AUTH_REVOKED' }     — refresh token revoked
//   • 503 { ok: false, code: 'AUTH_STALE' }       — temp refresh failure
//   • 502 { ok: false, code: 'ZOHO_API_ERROR' }   — Zoho returned non-2xx
//   • 400 — missing orgId/userId
//   • 401 — auth required (from requireAuth)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { db } from '@/lib/db';
import {
  getValidAccessToken,
  getApiBaseUrl,
  resolveOrgUserFromHeaders,
} from '@/lib/integrations/zoho/oauth';
import type { ZohoInvoice } from '@/lib/integrations/zoho/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function zohoError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, code, error: message }, { status });
}

export async function GET(req: Request) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const { orgId, userId } = resolveOrgUserFromHeaders(req);
  if (!orgId || !userId) {
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
      sort_order: 'D', // descending (most recent first)
    });
    const res = await fetch(`${apiBaseUrl}/invoices?${params.toString()}`, {
      headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
      cache: 'no-store',
    });
    const data = (await res.json().catch(() => ({}))) as {
      invoices?: ZohoInvoice[];
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

    const invoices = data.invoices ?? [];
    return NextResponse.json({
      ok: true,
      data: {
        invoices,
        organizationName: row.zohoOrgName,
        count: invoices.length,
      },
    });
  } catch (e) {
    console.error('[zoho/invoices] error:', e);
    return zohoError(500, 'INTERNAL_ERROR', 'Unexpected error.');
  }
}
