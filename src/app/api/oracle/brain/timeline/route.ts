// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Brain — Timeline API
// GET /api/oracle/brain/timeline?firmId=...&q=...&limit=...
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getMemoryTimeline, searchTimeline, getTimelineStats } from '@/lib/oracle/brain/timeline';
import type { BrainMemoryType } from '@/lib/oracle/brain/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const firmId = url.searchParams.get('firmId') || 'preview-org';
    const action = url.searchParams.get('action') || 'timeline';
    const limit = parseInt(url.searchParams.get('limit') || '200', 10);
    const query = url.searchParams.get('q') || '';
    const typeParam = url.searchParams.get('types');
    const types = typeParam ? (typeParam.split(',') as BrainMemoryType[]) : undefined;

    let result: unknown;
    if (action === 'stats') {
      result = await getTimelineStats(firmId);
    } else if (query) {
      result = await searchTimeline({ firmId, query, types, limit });
    } else {
      result = await getMemoryTimeline({ firmId, types, limit });
    }
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
