// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/integrations/zoho/organizations
//
// Lists the user's REAL Zoho Books organizations via an authenticated
// GET /organizations call. Used by the organization-selection step after OAuth.
//
// Returns:
//   { ok: true, organizations: [{organization_id, name, is_default_org, ...}],
//     selectedZohoOrgId: string|null }
//
// The currently-selected zohoOrgId (from the token row) is returned as
// `selectedZohoOrgId` so the UI can highlight the active org.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  resolveOrgUserFromHeaders,
  loadTokens,
  getValidAccessToken,
  getZohoEndpoints,
} from '@/lib/integrations/zoho-books';
import { rateLimit, rateLimitedResponse } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export interface ZohoOrgListItem {
  organization_id: string;
  name: string;
  is_default_org: boolean;
  is_org_active: boolean | null;
  plan_name: string | null;
  plan_type: string | null;
  country_code: string | null;
  currency_code: string | null;
  gst_no: string | null;
}

export async function GET(req: Request) {
  try {
    const { orgId, userId } = resolveOrgUserFromHeaders(req);
    if (!orgId || !userId) {
      return NextResponse.json(
        { ok: false, error: 'Organization + user context required.' },
        { status: 400 },
      );
    }

    // Rate limit: 10 org-list requests per minute per user.
    const rl = rateLimit(req, { windowMs: 60_000, max: 10 }, 'zoho-orgs', userId);
    if (rl.denied) {
      return rateLimitedResponse(rl.retryAfterSec);
    }

    const { accessToken, error: tokenError } = await getValidAccessToken(orgId, userId);
    if (!accessToken) {
      return NextResponse.json(
        {
          ok: false,
          error: tokenError ?? 'Zoho Books is not connected.',
          needsReconnect: true,
        },
        { status: 401 },
      );
    }

    const { stored } = await loadTokens(orgId, userId);
    const selectedZohoOrgId = stored?.zohoOrgId ?? null;

    const endpoints = getZohoEndpoints();
    let resp: Response;
    try {
      resp = await fetch(`${endpoints.apiBaseUrl}/organizations`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      return NextResponse.json(
        { ok: false, error: `Could not reach Zoho Books: ${msg}`, selectedZohoOrgId },
        { status: 502 },
      );
    }

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      const status = resp.status;
      let error: string;
      if (status === 401) error = 'Access token expired — reconnect Zoho Books.';
      else if (status === 403) error = 'Permission denied (403).';
      else if (status === 429) error = 'Rate limit reached (429). Try again shortly.';
      else error = `Zoho returned HTTP ${status}: ${text.slice(0, 200)}`;
      return NextResponse.json(
        { ok: false, error, httpStatus: status, needsReconnect: status === 401, selectedZohoOrgId },
        { status: 200 },
      );
    }

    const data = (await resp.json()) as {
      organizations?: Array<Record<string, unknown>>;
    };
    const raw = data.organizations ?? [];
    const organizations: ZohoOrgListItem[] = raw.map((o) => ({
      organization_id: String(o.organization_id ?? ''),
      name: String(o.name ?? 'Unknown'),
      is_default_org: Boolean(o.is_default_org),
      is_org_active: (o.is_org_active as boolean | null) ?? null,
      plan_name: (o.plan_name as string | null) ?? null,
      plan_type: (o.plan_type as string | null) ?? null,
      country_code: (o.country_code as string | null) ?? null,
      currency_code: (o.currency_code as string | null) ?? null,
      gst_no: (o.gst_no as string | null) ?? null,
    }));

    return NextResponse.json({
      ok: true,
      organizations,
      selectedZohoOrgId,
    });
  } catch (err) {
    console.error('[/api/integrations/zoho/organizations] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to list organizations.' },
      { status: 500 },
    );
  }
}
