// GET  /api/oracle-ai/sessions       — list sessions for the caller
// POST /api/oracle-ai/sessions       — create a new session

import { NextRequest, NextResponse } from 'next/server';
import { resolveOracleAICtx, toErrorResponse } from '@/lib/oracle-ai/api-auth';
import { createSession, listSessions } from '@/lib/oracle-ai/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveOracleAICtx(req);
    const url = new URL(req.url);
    const status = url.searchParams.get('status') as 'active' | 'archived' | 'pinned' | 'deleted' | null;
    const limit = Number(url.searchParams.get('limit') ?? 50);
    const sessions = await listSessions({
      firmId: ctx.firmId,
      userId: ctx.uid,
      status: status ?? 'active',
      limit,
    });
    return NextResponse.json({ sessions });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await resolveOracleAICtx(req);
    const body = await req.json().catch(() => ({}));
    const session = await createSession({
      firmId: ctx.firmId,
      userId: ctx.uid,
      title: body.title,
      agentId: body.agentId,
      metadata: body.metadata,
    });
    return NextResponse.json({ session });
  } catch (err) {
    return toErrorResponse(err);
  }
}
