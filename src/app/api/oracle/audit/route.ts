// GET /api/oracle/audit — Security Engine™ stats + recent audit log
// Returns 24h security aggregates and the most recent audit entries.
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { getSecurityStats, getRecentAuditLog } from '@/lib/oracle-core/security';

export async function GET(request: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;
  const { searchParams } = new URL(request.url);
  const orgId0 = searchParams.get('orgId') || searchParams.get('organizationId') || searchParams.get('firmId') || '';
  if (orgId0) {
    const orgResult = await requireOrgMembership(uid, orgId0);
    if (orgResult instanceof NextResponse) return orgResult;
  }

  try {
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!, 10)
      : 50;
    const [stats, recent] = await Promise.all([
      getSecurityStats(),
      getRecentAuditLog(Math.min(limit, 200)),
    ]);
    return NextResponse.json({ stats, recent, total: recent.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
