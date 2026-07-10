// POST /api/integrations/disconnect — disconnect an installed integration.
import { NextRequest, NextResponse } from 'next/server'
import { disconnectIntegration } from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    if (!body.installationId) return NextResponse.json({ error: 'installationId required' }, { status: 400 })
    const disconnected = await disconnectIntegration(body.installationId)
    return NextResponse.json({ ok: true, installed: disconnected })
  } catch (err) {
    console.error('[api/integrations/disconnect] error:', err)
    return NextResponse.json({ error: (err as Error).message ?? 'Failed to disconnect' }, { status: 500 })
  }
}
