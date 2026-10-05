/**
 * Enterprise Identity™ — SSO, SAML, OIDC, OAuth, MFA, Passkeys, SCIM
 * provisioning, session policies and device trust.
 *
 * Each tenant configures which identity providers are enabled/enforced.
 * provisionUser() simulates SCIM 2.0 automatic user provisioning — creating
 * a TenantMember from an IdP assertion.
 *
 * Tenant-scoped. Secrets are never returned by the API (config is redacted).
 */
import { db } from '@/lib/db'
import { IDENTITY_PROVIDERS } from './types'

export interface IdentityProviderMeta {
  key: string
  name: string
  category: string
}

export interface IdentityConfigRecord {
  id: string
  providerKey: string
  name: string
  category: string
  enabled: boolean
  enforced: boolean
  config: Record<string, unknown>
  provisionedUsers: number
  lastProvisionedAt: string | null
  sessionPolicyMin: number
  createdAt: string
  updatedAt: string
}

export interface ProvisioningResult {
  memberId: string
  userId: string
  email: string
  name: string
  providerKey: string
  provisioned: true
}

/** Default identity configs to seed — mirrors the IDENTITY_PROVIDERS catalogue. */
export const DEFAULT_IDENTITY_CONFIGS = IDENTITY_PROVIDERS.map((p) => ({
  providerKey: p.key,
  name: p.name,
  category: p.category,
  enabled: ['google', 'mfa', 'magic_link'].includes(p.key), // sensible defaults on
  enforced: p.key === 'mfa', // MFA enforced by default
  sessionPolicyMin: p.category === 'security' ? 480 : 60,
}))

function mapConfig(r: {
  id: string; providerKey: string; name: string; category: string; enabled: boolean; enforced: boolean;
  config: string; provisionedUsers: number; lastProvisionedAt: Date | null; sessionPolicyMin: number;
  createdAt: Date; updatedAt: Date;
}): IdentityConfigRecord {
  let config: Record<string, unknown> = {}
  try { config = JSON.parse(r.config) as Record<string, unknown> } catch { /* empty */ }
  // Redact secrets before returning
  const safe: Record<string, unknown> = { ...config }
  for (const k of Object.keys(safe)) {
    if (/secret|password|token|key/i.test(k)) safe[k] = '••••••••'
  }
  return {
    id: r.id, providerKey: r.providerKey, name: r.name, category: r.category,
    enabled: r.enabled, enforced: r.enforced, config: safe,
    provisionedUsers: r.provisionedUsers,
    lastProvisionedAt: r.lastProvisionedAt?.toISOString() ?? null,
    sessionPolicyMin: r.sessionPolicyMin,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  }
}

export async function listIdentityConfigs(tenantId: string): Promise<IdentityConfigRecord[]> {
  const rows = await db.identityConfig.findMany({ where: { tenantId }, orderBy: { category: 'asc' } })
  return rows.map(mapConfig)
}

export async function toggleProvider(
  tenantId: string,
  providerKey: string,
  enabled: boolean,
): Promise<IdentityConfigRecord | null> {
  const r = await db.identityConfig.findFirst({ where: { tenantId, providerKey } })
  if (!r) return null
  const updated = await db.identityConfig.update({ where: { id: r.id }, data: { enabled } })
  return mapConfig(updated)
}

export async function enforceProvider(
  tenantId: string,
  providerKey: string,
  enforced: boolean,
): Promise<IdentityConfigRecord | null> {
  const r = await db.identityConfig.findFirst({ where: { tenantId, providerKey } })
  if (!r) return null
  const updated = await db.identityConfig.update({ where: { id: r.id }, data: { enforced } })
  return mapConfig(updated)
}

/**
 * SCIM-style automatic user provisioning — creates a TenantMember from an
 * IdP assertion. Returns the new member id. Idempotent on email.
 */
export async function provisionUser(
  tenantId: string,
  data: { email: string; name: string; providerKey: string; roleKey?: string; title?: string },
): Promise<ProvisioningResult> {
  const existingMember = await db.tenantMember.findFirst({
    where: { tenantId, userId: data.email },
  })
  if (existingMember) {
    return {
      memberId: existingMember.id,
      userId: existingMember.userId,
      email: data.email,
      name: data.name,
      providerKey: data.providerKey,
      provisioned: true,
    }
  }
  const role = data.roleKey
    ? await db.enterpriseRole.findFirst({ where: { tenantId, key: data.roleKey } })
    : await db.enterpriseRole.findFirst({ where: { tenantId, isDefault: true } })
  const member = await db.tenantMember.create({
    data: {
      tenantId,
      userId: data.email,
      roleId: role?.id,
      title: data.title ?? 'Provisioned User',
      status: 'active',
    },
  })
  // bump provisionedUsers count on the provider config
  const cfg = await db.identityConfig.findFirst({ where: { tenantId, providerKey: data.providerKey } })
  if (cfg) {
    await db.identityConfig.update({
      where: { id: cfg.id },
      data: { provisionedUsers: { increment: 1 }, lastProvisionedAt: new Date() },
    })
  }
  // audit log the provisioning
  await db.enterpriseAuditLog.create({
    data: {
      tenantId,
      actorType: 'system',
      actorName: `SCIM/${data.providerKey}`,
      action: 'create',
      entity: 'tenant_member',
      entityId: member.id,
      summary: `Provisioned user ${data.email} via ${data.providerKey}`,
      severity: 'medium',
      metadata: JSON.stringify({ providerKey: data.providerKey, email: data.email }),
    },
  })
  return {
    memberId: member.id,
    userId: member.userId,
    email: data.email,
    name: data.name,
    providerKey: data.providerKey,
    provisioned: true,
  }
}

export async function getIdentityStats(tenantId: string): Promise<{
  totalProviders: number
  enabledProviders: number
  enforcedProviders: number
  provisionedUsers: number
  byCategory: { category: string; total: number; enabled: number }[]
}> {
  const [total, enabled, enforced, provisionedAgg, byCatRaw] = await Promise.all([
    db.identityConfig.count({ where: { tenantId } }),
    db.identityConfig.count({ where: { tenantId, enabled: true } }),
    db.identityConfig.count({ where: { tenantId, enforced: true } }),
    db.identityConfig.aggregate({ where: { tenantId }, _sum: { provisionedUsers: true } }),
    db.identityConfig.groupBy({ by: ['category'], where: { tenantId }, _count: { _all: true } }),
  ])
  const enabledByCat = await db.identityConfig.groupBy({ by: ['category'], where: { tenantId, enabled: true }, _count: { _all: true } })
  const enabledMap = new Map(enabledByCat.map((g) => [g.category, g._count._all]))
  return {
    totalProviders: total,
    enabledProviders: enabled,
    enforcedProviders: enforced,
    provisionedUsers: provisionedAgg._sum.provisionedUsers ?? 0,
    byCategory: byCatRaw.map((g) => ({ category: g.category, total: g._count._all, enabled: enabledMap.get(g.category) ?? 0 })),
  }
}

export async function ensureDefaultIdentityConfigs(tenantId: string): Promise<void> {
  const existing = await db.identityConfig.count({ where: { tenantId } })
  if (existing > 0) return
  await db.identityConfig.createMany({
    data: DEFAULT_IDENTITY_CONFIGS.map((c) => ({
      tenantId,
      providerKey: c.providerKey,
      name: c.name,
      category: c.category,
      enabled: c.enabled,
      enforced: c.enforced,
      config: JSON.stringify({}),
      sessionPolicyMin: c.sessionPolicyMin,
    })),
  })
}
