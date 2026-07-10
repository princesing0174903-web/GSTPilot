import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, getUsageSummary, getUsageTimeseries, USAGE_METRICS } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    const url = new URL(req.url)
    const days = Number(url.searchParams.get('days') ?? 30)
    const [summary, timeseries] = await Promise.all([
      getUsageSummary(tenant.id, days),
      getUsageTimeseries(tenant.id, days),
    ])
    return NextResponse.json({ summary, timeseries, metrics: USAGE_METRICS, days })
  } catch (err) {
    console.error('[api/usage] error:', err)
    return NextResponse.json({ error: 'Failed to load usage' }, { status: 500 })
  }
}
