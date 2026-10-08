// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/oracle/context — Unified Oracle Financial Context
//
// Returns the single normalized context layer that every Oracle surface reads
// from. Includes: business profile, revenue, expenses, cash flow, customers,
// suppliers, GST, invoices, banking, risk, integrations, evidence index.
//
// Every section carries a `source` block with environment (LIVE/SANDBOX/DEMO/
// STALE/UNAVAILABLE), lastUpdatedAt, and connectionState — so Oracle never
// presents stale or sandbox data as live financial truth.
//
// Auth: requireAuth + requireOrgMembership (server-enforced).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { getUnifiedOracleContext, invalidateUnifiedContext } from '@/lib/oracle/context/builder';

export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  const url = new URL(req.url);
  const orgId = url.searchParams.get('orgId') ?? '';
  const refresh = url.searchParams.get('refresh') === '1';

  const orgResult = await requireOrgMembership(uid, orgId);
  if (orgResult instanceof NextResponse) return orgResult;

  try {
    if (refresh) invalidateUnifiedContext(orgId);
    const ctx = await getUnifiedOracleContext(orgId, { forceRefresh: refresh });
    return NextResponse.json({
      ok: true,
      context: ctx,
    });
  } catch (err) {
    return friendlyApiError(err, 'We could not load VEYRO AI context right now.');
  }
}
