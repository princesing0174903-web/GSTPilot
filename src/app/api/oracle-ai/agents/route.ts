// GET /api/oracle-ai/agents — list active agents (built-in + custom)

import { NextRequest, NextResponse } from 'next/server';
import { resolveOracleAICtx, toErrorResponse } from '@/lib/oracle-ai/api-auth';
import { listAgents } from '@/lib/oracle-ai/agents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveOracleAICtx(req);
    const agents = await listAgents(ctx.firmId);
    return NextResponse.json({ agents });
  } catch (err) {
    return toErrorResponse(err);
  }
}
