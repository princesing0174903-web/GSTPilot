// GET /api/oracle-ai/tools — list available tool schemas (for the agent UI)

import { NextRequest, NextResponse } from 'next/server';
import { resolveOracleAICtx, toErrorResponse } from '@/lib/oracle-ai/api-auth';
import { listToolSchemas } from '@/lib/oracle-ai/tools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await resolveOracleAICtx(req);
    const tools = listToolSchemas();
    return NextResponse.json({ tools });
  } catch (err) {
    return toErrorResponse(err);
  }
}
