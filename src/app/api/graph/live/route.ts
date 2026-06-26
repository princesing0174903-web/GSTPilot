import { NextResponse } from 'next/server';
import { getLiveEvents, getCacheStats } from '@/lib/graph/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/graph/live — returns the last 50 live events + cache stats.
// The UI polls this endpoint to display real-time graph updates.
export async function GET() {
  try {
    const events = getLiveEvents();
    const cacheStats = getCacheStats();
    return NextResponse.json(
      { events, cacheStats, count: events.length },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (err) {
    console.error('[graph/live] GET error', err);
    return NextResponse.json(
      { error: 'Failed to load live events', detail: String(err) },
      { status: 500 },
    );
  }
}
