// GET /api/oracle/reasoning — list reasoning records
// POST /api/oracle/reasoning — create new reasoning (deprecated; use /api/oracle/ask)
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { listReasoning, getReasoningStats, reason } from '@/lib/oracle-core/reasoning';
import type { ReasoningRequest } from '@/lib/oracle-core/types';

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
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
    const statsOnly = searchParams.get('stats') === 'true';

    if (statsOnly) {
      const stats = await getReasoningStats();
      return NextResponse.json(stats);
    }

    const records = await listReasoning(limit);
    return NextResponse.json({ records, total: records.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  try {
    const body = (await request.json()) as Partial<ReasoningRequest>;
    const orgId0 = (body.firmId as string) || (body.orgId as string) || (body.organizationId as string) || '';
    if (orgId0) {
      const orgResult = await requireOrgMembership(uid, orgId0);
      if (orgResult instanceof NextResponse) return orgResult;
    }
    const result = await reason({
      firmId: body.firmId || 'gstpilot-default-firm',
      userId: body.userId ?? null,
      request: body.request || '',
      requestType: body.requestType || 'ask',
      executives: body.executives,
      callLLM: body.callLLM,
      preferredTier: body.preferredTier,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
