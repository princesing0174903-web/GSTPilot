import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, globalSearch } from '@/lib/enterprise'
import { requireAuth, requireOrgMembership } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult
    const url = new URL(req.url)
    const organizationId = url.searchParams.get('organizationId')
    const orgResult = await requireOrgMembership(uid, organizationId)
    if (orgResult instanceof NextResponse) return orgResult
    await seedEnterprise()
    const tenant = await resolveTenant()
    const q = url.searchParams.get('q') ?? ''
    const limit = Number(url.searchParams.get('limit') ?? 30)
    // Pass organizationId so the search can scope Client/Invoice queries by firmId.
    const results = await globalSearch(tenant.id, q, limit, organizationId!)
    return NextResponse.json({ query: q, results, total: results.length })
  } catch (err) {
    console.error('[api/global-search] error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
