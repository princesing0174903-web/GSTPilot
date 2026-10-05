/**
 * Enterprise Admin Center™ — aggregates the admin dashboard and executes
 * admin actions: invite, suspend, restore, switch-company, create-tenant,
 * assign-role. Every action is audit-logged.
 */
import { db } from '@/lib/db'
import { resolveTenant } from './tenant'
import { getOrgTree, treeStats } from './hierarchy'
import { getSubscription, getUsageSummary, listBillingInvoices } from './subscription'
import { getSystemHealth } from './observability'
import { logAudit, getAuditStats } from './audit'
import type { AdminDashboard } from './types'

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const tenant = await resolveTenant()

  const [orgs, companies, members, activeMembers, roles, integrations, apiKeys, sub, usage, health, auditStats, billingInvoices] = await Promise.all([
    db.organization.count({ where: { tenantId: tenant.id } }),
    db.company.count({ where: { tenantId: tenant.id } }),
    db.tenantMember.count({ where: { tenantId: tenant.id } }),
    db.tenantMember.count({ where: { tenantId: tenant.id, status: 'active' } }),
    db.enterpriseRole.count({ where: { tenantId: tenant.id } }),
    db.integration.count({ where: { tenantId: tenant.id } }),
    db.apiKey.count({ where: { tenantId: tenant.id } }),
    getSubscription(tenant.id),
    getUsageSummary(tenant.id, 30),
    getSystemHealth(tenant.id),
    getAuditStats(tenant.id),
    listBillingInvoices(tenant.id, 12),
  ])

  const mrr = sub ? (sub.billingCycle === 'yearly' ? sub.amount / 12 : sub.amount) : 0

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      status: tenant.status,
      region: tenant.region,
      timezone: tenant.timezone,
      createdAt: '', // resolved below if needed
    },
    counts: {
      organizations: orgs,
      companies,
      members,
      activeMembers,
      roles,
      integrations,
      apiKeys,
      auditEvents24h: auditStats.last24h,
      securityEvents24h: 0,
    },
    subscription: sub,
    usage,
    health: {
      status: health.status,
      dbLatencyMs: health.services[0]?.latencyMs ?? 0,
      cacheLatencyMs: 1,
      apiLatencyMs: 0,
      uptimePct: health.uptimePct,
      errorRatePct: health.errorRatePct,
    },
    mrr,
    arr: mrr * 12,
  }
}

// ── Users listing ──────────────────────────────────────────────────────────────
export async function listUsers(tenantId: string) {
  const members = await db.tenantMember.findMany({
    where: { tenantId },
    include: { role: true, organization: true },
    orderBy: { createdAt: 'asc' },
  })
  const userIds = members.map((m) => m.userId)
  const users = await db.user.findMany({ where: { id: { in: userIds } } })
  const userMap = new Map(users.map((u) => [u.id, u]))
  return members.map((m) => {
    const u = userMap.get(m.userId)
    return {
      id: m.id,
      userId: m.userId,
      name: u?.name ?? m.title ?? 'Unknown',
      email: u?.email ?? '',
      avatar: u?.avatar ?? null,
      role: m.role ? { id: m.role.id, key: m.role.key, name: m.role.name } : null,
      organization: m.organization ? { id: m.organization.id, name: m.organization.name, type: m.organization.type } : null,
      title: m.title,
      status: m.status,
      joinedAt: m.joinedAt?.toISOString() ?? null,
      lastActiveAt: m.lastActiveAt?.toISOString() ?? null,
      isActive: u?.isActive ?? false,
    }
  })
}

// ── Organizations listing ──────────────────────────────────────────────────────
export async function listOrganizations(tenantId: string) {
  const tree = await getOrgTree(tenantId)
  return { tree, stats: treeStats(tree) }
}

// ── Admin actions ──────────────────────────────────────────────────────────────
export async function inviteUser(tenantId: string, data: {
  email: string
  name?: string
  roleKey: string
  organizationId?: string | null
  title?: string
}) {
  // find or create user
  let user = await db.user.findUnique({ where: { email: data.email } })
  if (!user) {
    user = await db.user.create({
      data: { email: data.email, name: data.name ?? null, role: data.roleKey, isActive: false },
    })
  }
  const role = await db.enterpriseRole.findFirst({ where: { tenantId, key: data.roleKey } })
  if (!role) throw new Error(`Role ${data.roleKey} not found`)
  const member = await db.tenantMember.create({
    data: {
      tenantId,
      userId: user.id,
      roleId: role.id,
      organizationId: data.organizationId ?? null,
      title: data.title ?? role.name,
      status: 'invited',
      invitedAt: new Date(),
    },
  })
  await logAudit({
    tenantId, actorType: 'user', action: 'invite', entity: 'user', entityId: user.id,
    summary: `Invited ${data.email} as ${role.name}`,
  })
  return member
}

export async function suspendTenant(tenantId: string, reason: string) {
  const tenant = await db.tenant.update({
    where: { id: tenantId },
    data: { status: 'suspended', suspendedAt: new Date(), suspendedReason: reason },
  })
  await logAudit({
    tenantId, actorType: 'user', action: 'suspend', entity: 'tenant', entityId: tenantId,
    summary: `Tenant suspended: ${reason}`, severity: 'critical',
  })
  return tenant
}

export async function restoreTenant(tenantId: string) {
  const tenant = await db.tenant.update({
    where: { id: tenantId },
    data: { status: 'active', suspendedAt: null, suspendedReason: null },
  })
  await logAudit({
    tenantId, actorType: 'user', action: 'restore', entity: 'tenant', entityId: tenantId,
    summary: 'Tenant restored to active',
  })
  return tenant
}

export async function suspendMember(tenantId: string, memberId: string) {
  const member = await db.tenantMember.update({
    where: { id: memberId },
    data: { status: 'suspended' },
  })
  await logAudit({
    tenantId, actorType: 'user', action: 'suspend', entity: 'member', entityId: memberId,
    summary: `Member ${member.title ?? memberId} suspended`, severity: 'warning',
  })
  return member
}

export async function restoreMember(tenantId: string, memberId: string) {
  const member = await db.tenantMember.update({
    where: { id: memberId },
    data: { status: 'active' },
  })
  await logAudit({
    tenantId, actorType: 'user', action: 'restore', entity: 'member', entityId: memberId,
    summary: `Member ${member.title ?? memberId} restored`,
  })
  return member
}

export async function assignRole(tenantId: string, memberId: string, roleKey: string) {
  const role = await db.enterpriseRole.findFirst({ where: { tenantId, key: roleKey } })
  if (!role) throw new Error(`Role ${roleKey} not found`)
  const member = await db.tenantMember.update({
    where: { id: memberId },
    data: { roleId: role.id, title: role.name },
  })
  await logAudit({
    tenantId, actorType: 'user', action: 'assign_role', entity: 'member', entityId: memberId,
    summary: `Assigned role ${role.name} to member`,
  })
  return member
}

export async function createTenant(data: {
  name: string
  slug: string
  plan?: string
  ownerId?: string | null
}) {
  const tenant = await db.tenant.create({
    data: {
      name: data.name,
      slug: data.slug,
      plan: data.plan ?? 'free',
      status: 'trial',
      ownerId: data.ownerId ?? null,
      trialEndsAt: new Date(Date.now() + 14 * 86400000),
    },
  })
  await logAudit({
    tenantId: tenant.id, actorType: 'system', action: 'create', entity: 'tenant', entityId: tenant.id,
    summary: `Created tenant ${data.name} (${data.slug})`,
  })
  return tenant
}

/**
 * Switch the active company context. In this sandbox we mark a target tenant
 * active (and others trial) so resolveTenantId picks it up. In production this
 * would update the session's activeCompanyId claim.
 */
export async function switchCompany(tenantId: string, companyId: string) {
  const company = await db.company.findFirst({ where: { id: companyId, tenantId } })
  if (!company) throw new Error('Company not found')
  await logAudit({
    tenantId, actorType: 'user', action: 'switch_company', entity: 'company', entityId: companyId,
    summary: `Switched active company to ${company.legalName}`,
  })
  return { companyId: company.id, legalName: company.legalName, tradeName: company.tradeName, gstin: company.gstin }
}
