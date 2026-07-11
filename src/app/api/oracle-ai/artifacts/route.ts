// GET /api/oracle-ai/artifacts — list artifacts (optionally filtered by sessionId)

import { NextRequest, NextResponse } from 'next/server';
import { resolveOracleAICtx, toErrorResponse } from '@/lib/oracle-ai/api-auth';
import { listArtifacts } from '@/lib/oracle-ai/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveOracleAICtx(req);
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
