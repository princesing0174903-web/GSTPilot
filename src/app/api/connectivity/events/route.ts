// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/connectivity/events
// Event stream — recent connector events + bridged business events.
// Every connector publishes events; Oracle reacts instantly.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getRecentEvents, getBusinessEventsAsConnectorEvents, getEventStats24h } from '@/lib/connectivity/events';

export async function GET(request: NextRequest) {
  try {
    const limit = parseInt(request.nextUrl.searchParams.get('limit') ?? '50', 10);
    const firmId = request.nextUrl.searchParams.get('firmId');
    const includeBusiness = request.nextUrl.searchParams.get('includeBusiness') !== 'false';

    const [connectorEvents, businessEvents, stats] = await Promise.all([
      getRecentEvents(limit, firmId),
      includeBusiness ? getBusinessEventsAsConnectorEvents(Math.floor(limit / 2), firmId) : Promise.resolve([]),
      getEventStats24h(firmId),
    ]);

    const events = [...connectorEvents, ...businessEvents]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);

    return NextResponse.json({ events, stats });
  } catch (err) {
    console.error('[Connectivity] Events error:', err);
    return NextResponse.json({ error: 'Failed to load events' }, { status: 500 });
  }
}
