import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, globalSearch } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    const url = new URL(req.url)
    const q = url.searchParams.get('q') ?? ''
    const limit = Number(url.searchParams.get('limit') ?? 30)
    const results = await globalSearch(tenant.id, q, limit)
    return NextResponse.json({ query: q, results, total: results.length })
  } catch (err) {
    console.error('[api/global-search] error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
