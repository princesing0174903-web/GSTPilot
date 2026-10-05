import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, listPolicies, listApprovals, getPolicyStats } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    const url = new URL(req.url)
    const status = url.searchParams.get('status') ?? undefined
    const appliesTo = url.searchParams.get('appliesTo') ?? undefined
    const approvalStatus = url.searchParams.get('approvalStatus') ?? undefined
    const [policies, approvals, stats] = await Promise.all([
      listPolicies(tenant.id, { status, appliesTo }),
      listApprovals(tenant.id, { status: approvalStatus, take: 100 }),
      getPolicyStats(tenant.id),
    ])
    return NextResponse.json({ policies, approvals, stats, total: policies.length })
  } catch (err) {
    console.error('[api/policies] error:', err)
    return NextResponse.json({ error: 'Failed to load policies' }, { status: 500 })
  }
}
