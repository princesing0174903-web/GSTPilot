import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, listUsers } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    const users = await listUsers(tenant.id)
    return NextResponse.json({ users, total: users.length })
  } catch (err) {
    console.error('[api/users] error:', err)
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
  }
}
