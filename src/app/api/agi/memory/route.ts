// GET /api/agi/memory
// Returns recent memories + the memory summary. Accepts ?q= for search.
import { NextRequest, NextResponse } from 'next/server';
import { getRecentMemories, getMemorySummary, searchMemories } from '@/lib/agi/memory';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get('q') ?? '';
    const summary = await getMemorySummary();
    if (q.trim()) {
      const results = await searchMemories(q, 30);
      return NextResponse.json({ ok: true, query: q, results, summary });
    }
    const recent = await getRecentMemories(50);
    return NextResponse.json({ ok: true, recent, summary });
  } catch (err) {
    console.error('[agi/memory] Error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to load AGI memory' }, { status: 500 });
  }
}
