// GET /api/oracle/memory — Unified Memory™ search & stats
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { searchMemory, getMemoryStats } from '@/lib/oracle-core/memory';

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
    const query = searchParams.get('q') ?? undefined;
    const category = searchParams.get('category') ?? undefined;
    const source = searchParams.get('source') ?? undefined;
    const entityType = searchParams.get('entityType') ?? undefined;
    const entityId = searchParams.get('entityId') ?? undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
    const minImportance = searchParams.get('minImportance') ? parseInt(searchParams.get('minImportance')!, 10) : undefined;
    const statsOnly = searchParams.get('stats') === 'true';

    if (statsOnly) {
      const stats = await getMemoryStats(orgId0 || undefined);
      return NextResponse.json(stats);
    }

    const result = await searchMemory({
      firmId: orgId0 || undefined,
      query,
      category: category as any,
      source: source as any,
      entityType,
      entityId,
      limit,
      minImportance,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
