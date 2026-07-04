import { NextResponse } from 'next/server'
import { seedEnterprise, resolveTenant, PERMISSION_CATALOGUE, SYSTEM_ROLES } from '@/lib/enterprise'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await seedEnterprise()
    const tenant = await resolveTenant()
    // Resolve the tenant's custom roles too (custom roles inherit/extend system permissions)
    const { db } = await import('@/lib/db')
    const customRoles = await db.enterpriseRole.findMany({
      where: { tenantId: tenant.id },
      select: { key: true, name: true, permissions: true, isSystem: true, isDefault: true },
    })
    // Build the permission matrix — which roles have which permissions
    const matrix = PERMISSION_CATALOGUE.map((perm) => {
      const roles: Record<string, boolean> = {}
      for (const r of SYSTEM_ROLES) {
        roles[r.key] = r.permissions.includes(perm)
      }
      return { permission: perm, roles }
    })
    return NextResponse.json({
      permissions: [...PERMISSION_CATALOGUE],
      systemRoles: SYSTEM_ROLES.map((r) => ({ key: r.key, name: r.name, description: r.description, permissionCount: r.permissions.length })),
      customRoles: customRoles.map((r) => {
        let perms: string[] = []
        try { perms = JSON.parse(r.permissions) as string[] } catch { /* empty */ }
        return { key: r.key, name: r.name, permissions: perms, isSystem: r.isSystem, isDefault: r.isDefault, permissionCount: perms.length }
      }),
      matrix,
      total: PERMISSION_CATALOGUE.length,
    })
  } catch (err) {
    console.error('[api/permissions] error:', err)
    return NextResponse.json({ error: 'Failed to load permissions' }, { status: 500 })
  }
}
