// GET /api/integrations/health — marketplace health dashboard.
import { NextRequest, NextResponse } from 'next/server'
import { seedMarketplace, getHealthDashboard } from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    await seedMarketplace()
    const health = await getHealthDashboard()
    return NextResponse.json(health)
  } catch (err) {
    console.error('[api/integrations/health] error:', err)
    return NextResponse.json({ error: 'Failed to load health' }, { status: 500 })
  }
}
