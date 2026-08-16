// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — Audit Log API
//
// GET /api/oracle/cfo/audit?organizationId=xxx&limit=20
//   Returns recent CFO actions with full audit detail.
//
// GET /api/oracle/cfo/audit?organizationId=xxx&pending=true
//   Returns pending approval requests.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { getRecentCfoAudit, getPendingApprovals } from '@/lib/oracle-cfo/approval';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  const { searchParams } = new URL(request.url);
  const organizationId = String(searchParams.get('organizationId') ?? searchParams.get('orgId') ?? searchParams.get('firmId') ?? 'preview-org');

  const orgResult = await requireOrgMembership(uid, organizationId);
  if (orgResult instanceof NextResponse) return orgResult;

  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100);
  const pending = searchParams.get('pending') === 'true';

  try {
    if (pending) {
      const approvals = await getPendingApprovals(organizationId, limit);
      return NextResponse.json({ approvals, count: approvals.length });
    }

    const audit = await getRecentCfoAudit(organizationId, limit);
    return NextResponse.json({ audit, count: audit.length });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Failed to load audit log.',
        detail: err instanceof Error ? err.message : 'Unknown error',
        audit: [],
        count: 0,
      },
      { status: 500 },
    );
  }
}
