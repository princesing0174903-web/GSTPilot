// GET /api/integrations/security — marketplace security overview.
import { NextRequest, NextResponse } from 'next/server'
import { seedMarketplace, getSecurityOverview } from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    await seedMarketplace()
    const security = await getSecurityOverview()
    return NextResponse.json(security)
  } catch (err) {
    console.error('[api/integrations/security] error:', err)
    return NextResponse.json({ error: 'Failed to load security overview' }, { status: 500 })
  }
}
