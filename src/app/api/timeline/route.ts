// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Timeline API
// GET /api/timeline?organizationId=...&limit=20
//
// Returns the most recent Business Timeline events for the org.
// Always returns 200 (even for local- orgs or missing orgId — returns []).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { listTimelineEvents } from '@/lib/timeline/emit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const organizationId = (searchParams.get('organizationId') ?? '').trim();
    const limitParam = searchParams.get('limit') ?? '20';
    const limit = parseInt(limitParam, 10) || 20;

    if (!organizationId) {
      return NextResponse.json({ events: [] });
    }

    const events = await listTimelineEvents(organizationId, limit);
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
