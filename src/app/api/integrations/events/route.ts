// GET /api/integrations/events — Event Bus™ events.
import { NextRequest, NextResponse } from 'next/server'
import { seedMarketplace, listEvents, eventBusStats } from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await seedMarketplace()
    const sp = req.nextUrl.searchParams
    const [events, stats] = await Promise.all([
      listEvents({
        limit: sp.get('limit') ? Number(sp.get('limit')) : 100,
        connectorSlug: sp.get('connectorSlug') ?? undefined,
        eventType: sp.get('eventType') ?? undefined,
        consumed: sp.get('consumed') === 'true' ? true : sp.get('consumed') === 'false' ? false : undefined,
        severity: sp.get('severity') ?? undefined,
      }),
      eventBusStats(),
    ])
    return NextResponse.json({ events, stats, total: events.length })
  } catch (err) {
    console.error('[api/integrations/events] error:', err)
    return NextResponse.json({ error: 'Failed to load events' }, { status: 500 })
  }
}
