import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, suspendTenant, suspendMember } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    const body = await req.json().catch(() => ({}))
    const { targetType, targetId, reason } = body as {
      targetType: 'tenant' | 'member'; targetId?: string; reason?: string
    }
    if (targetType === 'tenant') {
      const result = await suspendTenant(tenant.id, reason ?? 'No reason provided')
      return NextResponse.json({ tenant: result })
    }
    if (targetType === 'member') {
      if (!targetId) return NextResponse.json({ error: 'targetId is required' }, { status: 400 })
      const member = await suspendMember(tenant.id, targetId)
      return NextResponse.json({ member })
    }
    return NextResponse.json({ error: 'targetType must be tenant or member' }, { status: 400 })
  } catch (err) {
    console.error('[api/admin/suspend] error:', err)
    return NextResponse.json({ error: (err as Error).message || 'Failed to suspend' }, { status: 500 })
  }
}
