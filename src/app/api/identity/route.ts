import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, listIdentityConfigs, getIdentityStats } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    const [configs, stats] = await Promise.all([
      listIdentityConfigs(tenant.id),
      getIdentityStats(tenant.id),
    ])
    return NextResponse.json({ configs, stats, total: configs.length })
  } catch (err) {
    console.error('[api/identity] error:', err)
    return NextResponse.json({ error: 'Failed to load identity configs' }, { status: 500 })
  }
}
