import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, restoreTenant, restoreMember } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    const body = await req.json().catch(() => ({}))
    const { targetType, targetId } = body as {
      targetType: 'tenant' | 'member'; targetId?: string
    }
    if (targetType === 'tenant') {
      const result = await restoreTenant(tenant.id)
      return NextResponse.json({ tenant: result })
    }
    if (targetType === 'member') {
      if (!targetId) return NextResponse.json({ error: 'targetId is required' }, { status: 400 })
      const member = await restoreMember(tenant.id, targetId)
      return NextResponse.json({ member })
    }
    return NextResponse.json({ error: 'targetType must be tenant or member' }, { status: 400 })
  } catch (err) {
    console.error('[api/admin/restore] error:', err)
    return NextResponse.json({ error: (err as Error).message || 'Failed to restore' }, { status: 500 })
  }
}
