// GET /api/oracle/models — Multi-Model AI Router™ catalog & stats
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { getModelCatalog, getRouterStats, getRecentModelCalls } from '@/lib/oracle-core/router';

export async function GET(req: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;
  const url = new URL(req.url);
  const orgId0 = url.searchParams.get('orgId') || url.searchParams.get('organizationId') || url.searchParams.get('firmId') || '';
  if (orgId0) {
    const orgResult = await requireOrgMembership(uid, orgId0);
    if (orgResult instanceof NextResponse) return orgResult;
  }

  try {
    const [catalog, stats, recent] = await Promise.all([
      Promise.resolve(getModelCatalog()),
      getRouterStats(),
      getRecentModelCalls(20),
    ]);
    return NextResponse.json({
      catalog,
      stats,
      recentCalls: recent,
      totalModels: catalog.length,
      providers: Array.from(new Set(catalog.map((m) => m.provider))),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
