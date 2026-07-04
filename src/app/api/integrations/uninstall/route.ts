// POST /api/integrations/uninstall — uninstall an installed integration.
import { NextRequest, NextResponse } from 'next/server'
import { uninstallConnector } from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    if (!body.installationId) return NextResponse.json({ error: 'installationId required' }, { status: 400 })
    const result = await uninstallConnector(body.installationId)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[api/integrations/uninstall] error:', err)
    return NextResponse.json({ error: (err as Error).message ?? 'Failed to uninstall' }, { status: 500 })
  }
}
