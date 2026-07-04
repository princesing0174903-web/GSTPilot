// GET /api/integrations/logs — connector logs for an installation.
import { NextRequest, NextResponse } from 'next/server'
import { getLogs } from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const installationId = req.nextUrl.searchParams.get('installationId')
    if (!installationId) return NextResponse.json({ error: 'installationId required' }, { status: 400 })
    const limit = req.nextUrl.searchParams.get('limit') ? Number(req.nextUrl.searchParams.get('limit')) : 50
    const logs = await getLogs(installationId, limit)
    return NextResponse.json({ logs, total: logs.length })
  } catch (err) {
    console.error('[api/integrations/logs] error:', err)
    return NextResponse.json({ error: 'Failed to load logs' }, { status: 500 })
  }
}
