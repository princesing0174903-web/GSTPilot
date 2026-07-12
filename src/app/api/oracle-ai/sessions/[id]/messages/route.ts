// GET /api/oracle-ai/sessions/:id/messages — list messages in a session

import { NextRequest, NextResponse } from 'next/server';
import { resolveOracleAICtx, toErrorResponse } from '@/lib/oracle-ai/api-auth';
import { listMessages } from '@/lib/oracle-ai/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await resolveOracleAICtx(req);
    const { id } = await params;
    const messages = await listMessages(id, ctx.firmId);
    return NextResponse.json({ messages });
  } catch (err) {
    return toErrorResponse(err);
  }
}
