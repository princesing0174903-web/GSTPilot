import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, listAuditLogs, getAuditStats, AUDIT_ACTIONS } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    const url = new URL(req.url)
    const actorType = url.searchParams.get('actorType') ?? undefined
    const action = url.searchParams.get('action') ?? undefined
    const severity = url.searchParams.get('severity') ?? undefined
    const take = Number(url.searchParams.get('take') ?? 100)
    const [logs, stats] = await Promise.all([
      listAuditLogs(tenant.id, { take, actorType, action, severity }),
      getAuditStats(tenant.id),
    ])
    return NextResponse.json({ logs, stats, actions: AUDIT_ACTIONS })
  } catch (err) {
    console.error('[api/audit] error:', err)
    return NextResponse.json({ error: 'Failed to load audit logs' }, { status: 500 })
  }
}
