import { NextResponse } from 'next/server'
import { seedEnterprise, listFlags, getFlagStats, evaluateFlag, resolveTenant } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    await seedEnterprise()
    const url = new URL(req.url)
    const category = url.searchParams.get('category') ?? undefined
    const enabledParam = url.searchParams.get('enabled')
    const enabled = enabledParam === 'true' ? true : enabledParam === 'false' ? false : undefined
    const [flags, stats] = await Promise.all([
      listFlags({ category, enabled }),
      getFlagStats(),
    ])
    // If a tenant context is resolvable, resolve the effective on/off state per flag
    let evaluated: { key: string; name: string; on: boolean; category: string }[] | undefined
    try {
      const tenant = await resolveTenant()
      evaluated = flags.map((f) => ({
        key: f.key,
        name: f.name,
        category: f.category,
        on: evaluateFlag(f, { tenantId: tenant.id, planKey: tenant.plan }),
      }))
    } catch { /* no tenant — skip evaluation */ }
    return NextResponse.json({ flags, stats, evaluated, total: flags.length })
  } catch (err) {
    console.error('[api/feature-flags] error:', err)
    return NextResponse.json({ error: 'Failed to load feature flags' }, { status: 500 })
  }
}
