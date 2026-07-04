import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, listRoles, SYSTEM_ROLES, PERMISSION_CATALOGUE } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    const roles = await listRoles(tenant.id)
    return NextResponse.json({
      roles,
      systemRoles: SYSTEM_ROLES,
      permissions: PERMISSION_CATALOGUE,
    })
  } catch (err) {
    console.error('[api/roles] error:', err)
    return NextResponse.json({ error: 'Failed to load roles' }, { status: 500 })
  }
}
