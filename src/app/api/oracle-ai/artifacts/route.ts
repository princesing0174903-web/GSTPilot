// GET /api/oracle-ai/artifacts — list artifacts (optionally filtered by sessionId)

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { resolveOracleAICtx, toErrorResponse } from '@/lib/oracle-ai/api-auth';
import { listArtifacts } from '@/lib/oracle-ai/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  try {
    const ctx = await resolveOracleAICtx(req);
    if (!ctx.isDemo) {
      const orgResult = await requireOrgMembership(uid, ctx.firmId);
      if (orgResult instanceof NextResponse) return orgResult;
    }
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId) {
      return NextResponse.json({ artifacts: [] });
    }
    const artifacts = await listArtifacts(sessionId, ctx.firmId);
    return NextResponse.json({ artifacts });
  } catch (err) {
    return toErrorResponse(err);
  }
}
