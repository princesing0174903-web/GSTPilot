// GET /api/integrations/marketplace — browse the 2,000+ connector catalog.
import { NextRequest, NextResponse } from 'next/server'
import { seedMarketplace, browseMarketplace } from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await seedMarketplace()
    const sp = req.nextUrl.searchParams
    const result = await browseMarketplace({
      search: sp.get('search') ?? undefined,
      category: sp.get('category') ?? undefined,
      authType: sp.get('authType') ?? undefined,
      featured: sp.get('featured') === 'true',
      page: sp.get('page') ? Number(sp.get('page')) : 1,
      pageSize: sp.get('pageSize') ? Number(sp.get('pageSize')) : 60,
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[api/integrations/marketplace] error:', err)
    return NextResponse.json({ error: 'Failed to browse marketplace' }, { status: 500 })
  }
}
