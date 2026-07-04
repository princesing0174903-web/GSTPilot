// POST /api/integrations/sync — trigger a sync for an installed integration.
import { NextRequest, NextResponse } from 'next/server'
import { triggerSync } from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    if (!body.installationId) return NextResponse.json({ error: 'installationId required' }, { status: 400 })
    const job = await triggerSync(body.installationId, {
      type: body.type,
      direction: body.direction,
    })
    return NextResponse.json({ ok: true, job })
  } catch (err) {
    console.error('[api/integrations/sync] error:', err)
    return NextResponse.json({ error: (err as Error).message ?? 'Failed to sync' }, { status: 500 })
  }
}
