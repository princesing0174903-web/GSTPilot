// POST /api/integrations/install — install a connector from the catalog.
import { NextRequest, NextResponse } from 'next/server'
import { installConnector } from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    if (!body.connectorSlug) return NextResponse.json({ error: 'connectorSlug required' }, { status: 400 })
    const installed = await installConnector(body.connectorSlug)
    return NextResponse.json({ ok: true, installed })
  } catch (err) {
    console.error('[api/integrations/install] error:', err)
    return NextResponse.json({ error: (err as Error).message ?? 'Failed to install' }, { status: 500 })
  }
}
