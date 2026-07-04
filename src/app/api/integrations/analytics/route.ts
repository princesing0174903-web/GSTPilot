// GET /api/integrations/analytics — connector analytics dashboard.
import { NextRequest, NextResponse } from 'next/server'
import { seedMarketplace, getAnalytics } from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await seedMarketplace()
    const days = req.nextUrl.searchParams.get('days') ? Number(req.nextUrl.searchParams.get('days')) : 30
    const analytics = await getAnalytics(days)
    return NextResponse.json(analytics)
  } catch (err) {
    console.error('[api/integrations/analytics] error:', err)
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 })
  }
}
