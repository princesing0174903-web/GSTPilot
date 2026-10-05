// GET /api/oracle-ai/stats — aggregate stats for the workspace dashboard

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { resolveOracleAICtx, toErrorResponse } from '@/lib/oracle-ai/api-auth';
import { db } from '@/lib/db';
import { getTaskStats } from '@/lib/oracle-ai/tasks';
import { getKnowledgeStats } from '@/lib/oracle-ai/knowledge';
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
    const [taskStats, knowledgeStats, agents] = await Promise.all([
      getTaskStats(ctx.firmId),
      getKnowledgeStats(ctx.firmId),
      listAgents(ctx.firmId),
    ]);
    const sessionCount = await db.oracleAISession.count({
      where: { firmId: ctx.firmId, status: 'active' },
    });
    const messageCount = await db.oracleAIMessage.count({
      where: { firmId: ctx.firmId },
    });
    const artifactCount = await db.oracleAIArtifact.count({
      where: { firmId: ctx.firmId },
    });
    return NextResponse.json({
      sessions: sessionCount,
      messages: messageCount,
      artifacts: artifactCount,
      tasks: taskStats,
      knowledge: knowledgeStats,
      agents: agents.length,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
