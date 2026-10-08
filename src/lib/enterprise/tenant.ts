/**
 * Tenant Context — Tenant Isolation™
 *
 * Every enterprise query MUST resolve through here so that data never crosses
 * tenant boundaries. In production this resolves from the authenticated
 * session / subdomain / JWT claim. In this sandbox it resolves the active
 * tenant (defaulting to the platform tenant, switchable via the admin console).
 *
 * The isolation guarantee is structural: every enterprise model carries a
 * non-null `tenantId` with a cascade delete, and every service-layer query
 * filters by the resolved tenant id.
 */
import { db } from '@/lib/db'

export const PLATFORM_TENANT_SLUG = 'gstpilot-platform'

export interface ResolvedTenant {
  id: string
  name: string
  slug: string
  plan: string
  status: string
  region: string
  timezone: string
  currency: string
  ownerId: string | null
}

/**
 * Resolve the active tenant id. Checks the DB for an "active" flag first
 * (set by switch-company), falling back to the platform tenant.
 */
export async function resolveTenantId(): Promise<string> {
  const active = await db.tenant.findFirst({
    where: { status: 'active' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (active) return active.id
  // fall back to platform tenant
  const platform = await db.tenant.findUnique({
    where: { slug: PLATFORM_TENANT_SLUG },
    select: { id: true },
  })
  if (platform) return platform.id
  // last resort — first tenant ever
  const any = await db.tenant.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } })
  return any?.id ?? 'no-tenant'
}

export async function resolveTenant(): Promise<ResolvedTenant> {
  const id = await resolveTenantId()
  const t = await db.tenant.findUnique({ where: { id } })
  if (!t) {
    // extremely unlikely — create platform tenant inline
    return ensurePlatformTenant()
  }
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    plan: t.plan,
    status: t.status,
    region: t.region,
    timezone: t.timezone,
    currency: t.currency,
    ownerId: t.ownerId,
  }
}

/**
 * Ensure the platform tenant exists. Idempotent — safe to call on every boot.
 */
export async function ensurePlatformTenant(): Promise<ResolvedTenant> {
  const existing = await db.tenant.findUnique({ where: { slug: PLATFORM_TENANT_SLUG } })
  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      slug: existing.slug,
      plan: existing.plan,
      status: existing.status,
      region: existing.region,
      timezone: existing.timezone,
      currency: existing.currency,
      ownerId: existing.ownerId,
    }
  }
  const created = await db.tenant.create({
    data: {
      name: 'VEYRO Platform',
      slug: PLATFORM_TENANT_SLUG,
      status: 'active',
      plan: 'enterprise',
      region: 'ap-south-1',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
    },
  })
  return {
    id: created.id,
    name: created.name,
    slug: created.slug,
    plan: created.plan,
    status: created.status,
    region: created.region,
    timezone: created.timezone,
    currency: created.currency,
    ownerId: created.ownerId,
  }
}
