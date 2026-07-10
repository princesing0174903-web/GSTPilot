// GET /api/integrations/developer — developer platform (submissions, SDK, certifications).
import { NextRequest, NextResponse } from 'next/server'
import { seedMarketplace, listDeveloperSubmissions } from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    await seedMarketplace()
    const data = await listDeveloperSubmissions()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/integrations/developer] error:', err)
    return NextResponse.json({ error: 'Failed to load developer platform' }, { status: 500 })
  }
}
