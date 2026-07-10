// GET /api/oracle/insights — Knowledge Synthesis™ insights
import { NextRequest, NextResponse } from 'next/server';
import {
  listInsights,
  getInsightStats,
  getDailyBrief,
  synthesizeInsights,
} from '@/lib/oracle-core/insights';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statsOnly = searchParams.get('stats') === 'true';
    const briefOnly = searchParams.get('brief') === 'true';
    const category = searchParams.get('category') ?? undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;

    if (statsOnly) {
      const stats = await getInsightStats();
      return NextResponse.json(stats);
    }
    if (briefOnly) {
      const brief = await getDailyBrief();
      return NextResponse.json(brief);
    }

    const records = await listInsights(undefined, category as any, limit);
    return NextResponse.json({ records, total: records.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — trigger a fresh synthesis run
export async function POST() {
  try {
    const insights = await synthesizeInsights();
    return NextResponse.json({ insights, total: insights.length, synthesizedAt: new Date().toISOString() });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
