import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, assignRole } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    const body = await req.json().catch(() => ({}))
    const { memberId, roleKey } = body as { memberId: string; roleKey: string }
    if (!memberId || !roleKey) return NextResponse.json({ error: 'memberId and roleKey are required' }, { status: 400 })
    const member = await assignRole(tenant.id, memberId, roleKey)
    return NextResponse.json({ member })
  } catch (err) {
    console.error('[api/admin/assign-role] error:', err)
    return NextResponse.json({ error: (err as Error).message || 'Failed to assign role' }, { status: 500 })
  }
}
