// GET /api/integrations/categories — list marketplace categories with counts.
import { NextRequest, NextResponse } from 'next/server'
import { seedMarketplace, browseMarketplace } from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    await seedMarketplace()
    const { categories, total } = await browseMarketplace({ pageSize: 1 })
    return NextResponse.json({ categories, totalConnectors: total })
  } catch (err) {
    console.error('[api/integrations/categories] error:', err)
    return NextResponse.json({ error: 'Failed to load categories' }, { status: 500 })
  }
}
