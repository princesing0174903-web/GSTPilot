// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/integrations/zoho/organizations/select
//
// Stores the user's chosen Zoho Books organization ID on the ZohoBooksToken row.
// After OAuth, the default org is auto-mapped; this route lets the user switch
// to a different Zoho org if their account has multiple.
//
// Body: { zohoOrgId: string, zohoOrgName?: string }
//
// Validates that the chosen org actually belongs to the connected Zoho user by
// re-listing /organizations and confirming the id is present. This prevents a
// user from storing an arbitrary org id they don't own (tenant isolation).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  resolveOrgUserFromHeaders,
  loadTokens,
  getValidAccessToken,
  getZohoEndpoints,
} from '@/lib/integrations/zoho-books';
import { db } from '@/lib/db';
import { safeAudit } from '@/lib/audit/safe-write';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { orgId, userId } = resolveOrgUserFromHeaders(req);
    if (!orgId || !userId) {
      return NextResponse.json(
        { ok: false, error: 'Organization + user context required.' },
        { status: 400 },
      );
    }

    let body: { zohoOrgId?: string; zohoOrgName?: string } = {};
    try {
      body = (await req.json()) as { zohoOrgId?: string; zohoOrgName?: string };
    } catch {
      /* empty body */
    }
    const zohoOrgId = (body.zohoOrgId ?? '').trim();
    if (!zohoOrgId) {
      return NextResponse.json(
        { ok: false, error: 'zohoOrgId is required.' },
        { status: 400 },
      );
    }

    const { stored } = await loadTokens(orgId, userId);
    if (!stored) {
      return NextResponse.json(
        { ok: false, error: 'Zoho Books is not connected.', needsReconnect: true },
        { status: 401 },
      );
    }

    // Resolve a valid access token (auto-refresh).
    const { accessToken, error: tokenError } = await getValidAccessToken(orgId, userId);
    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: tokenError ?? 'Token expired — reconnect.', needsReconnect: true },
        { status: 401 },
      );
    }

    // Tenant-isolation check: confirm the requested org belongs to this user.
    const endpoints = getZohoEndpoints();
    let listResp: Response;
    try {
      listResp = await fetch(`${endpoints.apiBaseUrl}/organizations`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      return NextResponse.json(
        { ok: false, error: `Could not verify organization access: ${msg}` },
        { status: 502 },
      );
    }
    if (!listResp.ok) {
      const text = await listResp.text().catch(() => '');
      return NextResponse.json(
        {
          ok: false,
          error: `Zoho returned HTTP ${listResp.status}: ${text.slice(0, 200)}`,
          needsReconnect: listResp.status === 401,
        },
        { status: 200 },
      );
    }
    const listData = (await listResp.json()) as {
      organizations?: Array<{ organization_id: string; name: string }>;
    };
    const owned = (listData.organizations ?? []).find(
      (o) => String(o.organization_id) === zohoOrgId,
    );
    if (!owned) {
      // The user tried to select an org they don't own — reject.
      return NextResponse.json(
        {
          ok: false,
          error:
            'The selected organization does not belong to this Zoho account. Choose an organization from the list.',
        },
        { status: 403 },
      );
    }

    // Persist the selection.
    await db.zohoBooksToken.update({
      where: { id: stored.id },
      data: { zohoOrgId, zohoOrgName: owned.name },
    });

    try {
      await safeAudit({
        userId,
        action: 'ZOHO_BOOKS_ORG_SELECTED',
        entity: 'ZohoBooksToken',
        entityId: stored.id,
        details: `Selected Zoho Books organization: ${owned.name} (${zohoOrgId})`,
      });
    } catch {
      /* ignore */
    }

    return NextResponse.json({
      ok: true,
      zohoOrgId,
      zohoOrgName: owned.name,
    });
  } catch (err) {
    console.error('[/api/integrations/zoho/organizations/select] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to select organization.' },
      { status: 500 },
    );
  }
}
