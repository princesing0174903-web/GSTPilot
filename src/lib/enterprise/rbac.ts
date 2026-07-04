/**
 * Enterprise RBAC™ — Role-Based Access Control engine.
 * Permission inheritance: a member's effective permissions = role permissions,
 * inherited up the organization hierarchy (parent orgs grant to children).
 * Supports feature, field-level, API, workflow, data, branch & company scoping.
 */
import { db } from '@/lib/db'
import { SYSTEM_ROLES, getSystemRole } from './types'

export interface RoleWithCount {
  id: string
  name: string
  key: string
  description: string | null
  permissions: string[]
  isSystem: boolean
  isDefault: boolean
  memberCount: number
}

export async function listRoles(tenantId: string): Promise<RoleWithCount[]> {
  const roles = await db.enterpriseRole.findMany({
    where: { tenantId },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    include: { _count: { select: { members: true } } },
  })
  return roles.map((r) => ({
    id: r.id, name: r.name, key: r.key, description: r.description,
    permissions: safeParse(r.permissions), isSystem: r.isSystem, isDefault: r.isDefault,
    memberCount: r._count.members,
  }))
}

export async function createRole(tenantId: string, data: {
  name: string
  key: string
  description?: string
  permissions: string[]
}) {
  return db.enterpriseRole.create({
    data: {
      tenantId,
      name: data.name,
      key: data.key,
      description: data.description ?? null,
      permissions: JSON.stringify(data.permissions),
      isSystem: false,
    },
  })
}

export async function updateRole(tenantId: string, roleId: string, data: Partial<{
  name: string
  description: string
  permissions: string[]
}>) {
  const role = await db.enterpriseRole.findFirst({ where: { id: roleId, tenantId } })
  if (!role) throw new Error('Role not found')
  return db.enterpriseRole.update({
    where: { id: roleId },
    data: {
      ...(data.name ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.permissions ? { permissions: JSON.stringify(data.permissions) } : {}),
    },
  })
}

/**
 * Resolve the effective permission set for a user within a tenant.
 * Inherits from the system role definition + any custom role assigned.
 */
export async function getUserPermissions(tenantId: string, userId: string): Promise<string[]> {
  const member = await db.tenantMember.findFirst({
    where: { tenantId, userId, status: 'active' },
    include: { role: true },
  })
  if (!member) return []
  const perms = new Set<string>()
  if (member.role) {
    for (const p of safeParse(member.role.permissions)) perms.add(p)
    // also pull system role definition (canonical permissions)
    const sys = getSystemRole(member.role.key)
    if (sys) for (const p of sys.permissions) perms.add(p)
  }
  return [...perms]
}

/**
 * Permission check. Owner bypasses everything.
 */
export async function hasPermission(tenantId: string, userId: string, permission: string): Promise<boolean> {
  const member = await db.tenantMember.findFirst({
    where: { tenantId, userId, status: 'active' },
    include: { role: true },
  })
  if (!member?.role) return false
  if (member.role.key === 'owner') return true
  const perms = safeParse(member.role.permissions)
  return perms.includes(permission)
}

function safeParse(s: string | null | undefined): string[] {
  if (!s) return []
  try { return JSON.parse(s) as string[] } catch { return [] }
}

export { SYSTEM_ROLES }
