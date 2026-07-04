// GET /api/oracle/reasoning — list reasoning records
// POST /api/oracle/reasoning — create new reasoning (deprecated; use /api/oracle/ask)
import { NextRequest, NextResponse } from 'next/server';
import { listReasoning, getReasoningStats, reason } from '@/lib/oracle-core/reasoning';
import type { ReasoningRequest } from '@/lib/oracle-core/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
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
  try {
    const body = (await request.json()) as Partial<ReasoningRequest>;
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
