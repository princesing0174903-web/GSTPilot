// GET /api/integrations — list installed integrations for the active tenant.
import { NextRequest, NextResponse } from 'next/server'
import { seedMarketplace, listInstalled } from '@/lib/marketplace'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    await seedMarketplace()
    const installed = await listInstalled()
    return NextResponse.json({ installed, total: installed.length })
  } catch (err) {
    console.error('[api/integrations] error:', err)
    return NextResponse.json({ error: 'Failed to load integrations' }, { status: 500 })
  }
}
