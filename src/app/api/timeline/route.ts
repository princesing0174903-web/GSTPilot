// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Timeline API
// GET /api/timeline?organizationId=...&limit=20
//
// Returns the most recent Business Timeline events for the org.
// Always returns 200 (even for local- orgs or missing orgId — returns []).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { listTimelineEvents } from '@/lib/timeline/emit';
import { swrCache } from '@/lib/cache/swr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Timeline events change relatively infrequently — caching for 10s cuts
// duplicate Prisma queries when the dashboard + child widgets both fetch
// (or when the user rapidly switches back to the dashboard). The 30s
// auto-refresh in useTimelineEvents still gives fresh data — at worst the
// user sees data that's 10s + 30s = 40s old, which is fine for a feed.
const TIMELINE_CACHE_TTL_MS = 10_000;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const organizationId = (searchParams.get('organizationId') ?? '').trim();
    const limitParam = searchParams.get('limit') ?? '20';
    const limit = parseInt(limitParam, 10) || 20;
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    if (!organizationId) {
      return NextResponse.json({ events: [] });
    }

    // SWR cache — keyed by org + limit so different page sizes don't collide.
    // In-flight dedup ensures concurrent callers (dashboard + child widget)
    // share the same Prisma query.
    const events = await swrCache(
      '/api/timeline',
      `${organizationId}:${limit}`,
      TIMELINE_CACHE_TTL_MS,
      () => listTimelineEvents(organizationId, limit),
      { forceRefresh },
    );
    return NextResponse.json({ events });
  } catch (error) {
    console.error(
      '[/api/timeline] error:',
      error instanceof Error ? error.message : error,
    );
    // Never 500 — return empty so the dashboard widget doesn't crash.
    return NextResponse.json({ events: [] });
  }
}
