// POST /api/integrations/connect — connect an installed integration (OAuth/API key handshake).
import { NextRequest, NextResponse } from 'next/server'
import { connectIntegration } from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    if (!body.installationId) return NextResponse.json({ error: 'installationId required' }, { status: 400 })
    const connected = await connectIntegration(body.installationId, {
      connectedAccountId: body.connectedAccountId,
      scopes: body.scopes,
      config: body.config,
    })
    return NextResponse.json({ ok: true, installed: connected })
  } catch (err) {
    console.error('[api/integrations/connect] error:', err)
    return NextResponse.json({ error: (err as Error).message ?? 'Failed to connect' }, { status: 500 })
  }
}
