import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, getSystemHealth } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    const health = await getSystemHealth(tenant.id)
    return NextResponse.json(health)
  } catch (err) {
    console.error('[api/system/health] error:', err)
    return NextResponse.json({ error: 'Failed to load system health' }, { status: 500 })
  }
}
