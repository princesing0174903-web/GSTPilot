// GET /api/oracle-ai/agents — list active agents (built-in + custom)

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { resolveOracleAICtx, toErrorResponse } from '@/lib/oracle-ai/api-auth';
import { listAgents } from '@/lib/oracle-ai/agents';

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
    const agents = await listAgents(ctx.firmId);
    return NextResponse.json({ agents });
  } catch (err) {
    return toErrorResponse(err);
  }
}
