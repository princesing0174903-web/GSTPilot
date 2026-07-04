/**
 * Global Feature Flags™ — enable/disable modules, AI employees, beta features,
 * enterprise features, regional features and customer-specific features with
 * percentage rollouts and instant rollback.
 *
 * Flags are GLOBAL (not tenant-scoped) but can target specific tenants, plans
 * or organizations. evaluateFlag() resolves whether a flag is on for a given
 * tenant context using enabled state + rollout % + targeting rules.
 */
import { db } from '@/lib/db'

export interface FeatureFlagRecord {
  id: string
  key: string
  name: string
  description: string | null
  category: string
  enabled: boolean
  rolloutPct: number
  targetTenantIds: string[]
  targetPlanKeys: string[]
  targetOrgIds: string[]
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface FeatureFlagStats {
  total: number
  enabled: number
  disabled: number
  byCategory: { category: string; total: number; enabled: number }[]
}

/** Default flag catalogue — seeded on first run. */
export const DEFAULT_FLAGS: Omit<FeatureFlagRecord, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { key: 'module.ai_ceo', name: 'AI CEO™', description: 'Autonomous business operating system', category: 'module', enabled: true, rolloutPct: 100, targetTenantIds: [], targetPlanKeys: ['professional', 'business', 'enterprise'], targetOrgIds: [], metadata: null },
  { key: 'module.ai_workforce', name: 'AI Workforce™', description: 'Autonomous AI employee ecosystem', category: 'module', enabled: true, rolloutPct: 100, targetTenantIds: [], targetPlanKeys: ['professional', 'business', 'enterprise'], targetOrgIds: [], metadata: null },
  { key: 'module.ai_cfo', name: 'AI CFO™', description: 'Financial intelligence engine', category: 'module', enabled: true, rolloutPct: 100, targetTenantIds: [], targetPlanKeys: ['starter', 'professional', 'business', 'enterprise'], targetOrgIds: [], metadata: null },
  { key: 'module.digital_twin', name: 'Digital Twin™', description: 'Real-time business simulator', category: 'module', enabled: true, rolloutPct: 100, targetTenantIds: [], targetPlanKeys: ['professional', 'business', 'enterprise'], targetOrgIds: [], metadata: null },
  { key: 'module.business_graph', name: 'Business Graph™', description: 'Self-building knowledge graph', category: 'module', enabled: true, rolloutPct: 100, targetTenantIds: [], targetPlanKeys: ['professional', 'business', 'enterprise'], targetOrgIds: [], metadata: null },
  { key: 'module.integration_marketplace', name: 'Integration Marketplace™', description: '2,000+ connectors', category: 'module', enabled: true, rolloutPct: 100, targetTenantIds: [], targetPlanKeys: ['professional', 'business', 'enterprise'], targetOrgIds: [], metadata: null },
  { key: 'module.enterprise_cloud', name: 'Enterprise Cloud™', description: 'Multi-tenant global SaaS', category: 'enterprise', enabled: true, rolloutPct: 100, targetTenantIds: [], targetPlanKeys: ['business', 'enterprise'], targetOrgIds: [], metadata: null },
  { key: 'beta.unified_inbox', name: 'Unified Inbox (Beta)', description: 'All communications in one inbox', category: 'beta', enabled: false, rolloutPct: 25, targetTenantIds: [], targetPlanKeys: ['business', 'enterprise'], targetOrgIds: [], metadata: null },
  { key: 'beta.voice_first', name: 'Voice-First OS (Beta)', description: 'Voice-controlled business operations', category: 'beta', enabled: false, rolloutPct: 10, targetTenantIds: [], targetPlanKeys: ['enterprise'], targetOrgIds: [], metadata: null },
  { key: 'beta.multi_agent_dev', name: 'Multi-Agent Dev Platform (Beta)', description: 'Build custom AI agents', category: 'beta', enabled: false, rolloutPct: 5, targetTenantIds: [], targetPlanKeys: ['enterprise'], targetOrgIds: [], metadata: null },
  { key: 'region.eu_gdpr', name: 'EU GDPR Mode', description: 'Strict EU data residency & rights', category: 'regional', enabled: false, rolloutPct: 100, targetTenantIds: [], targetPlanKeys: [], targetOrgIds: [], metadata: { region: 'eu-west' } },
  { key: 'region.us_hipaa', name: 'US HIPAA Mode', description: 'Healthcare compliance mode', category: 'regional', enabled: false, rolloutPct: 100, targetTenantIds: [], targetPlanKeys: ['enterprise'], targetOrgIds: [], metadata: { region: 'us-east' } },
  { key: 'customer.white_label', name: 'White-Label Branding', description: 'Customer-specific branding', category: 'customer', enabled: false, rolloutPct: 100, targetTenantIds: [], targetPlanKeys: ['enterprise'], targetOrgIds: [], metadata: null },
  { key: 'ai_employee.sentinel', name: 'Sentinel (Risk AI)', description: 'Autonomous risk officer', category: 'ai_employee', enabled: true, rolloutPct: 100, targetTenantIds: [], targetPlanKeys: ['business', 'enterprise'], targetOrgIds: [], metadata: null },
  { key: 'ai_employee.justitia', name: 'Justitia (Legal AI)', description: 'Autonomous legal counsel', category: 'ai_employee', enabled: true, rolloutPct: 100, targetTenantIds: [], targetPlanKeys: ['business', 'enterprise'], targetOrgIds: [], metadata: null },
]

function mapFlag(r: {
  id: string; key: string; name: string; description: string | null; category: string;
  enabled: boolean; rolloutPct: number; targetTenantIds: string; targetPlanKeys: string;
  targetOrgIds: string; metadata: string | null; createdAt: Date; updatedAt: Date;
}): FeatureFlagRecord {
  let targetTenantIds: string[] = []
  let targetPlanKeys: string[] = []
  let targetOrgIds: string[] = []
  let metadata: Record<string, unknown> | null = null
  try { targetTenantIds = JSON.parse(r.targetTenantIds) as string[] } catch { /* empty */ }
  try { targetPlanKeys = JSON.parse(r.targetPlanKeys) as string[] } catch { /* empty */ }
  try { targetOrgIds = JSON.parse(r.targetOrgIds) as string[] } catch { /* empty */ }
  if (r.metadata) {
    try { metadata = JSON.parse(r.metadata) as Record<string, unknown> } catch { /* empty */ }
  }
  return {
    id: r.id, key: r.key, name: r.name, description: r.description, category: r.category,
    enabled: r.enabled, rolloutPct: r.rolloutPct, targetTenantIds, targetPlanKeys, targetOrgIds,
    metadata, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  }
}

export async function listFlags(opts?: { category?: string; enabled?: boolean }): Promise<FeatureFlagRecord[]> {
  const rows = await db.featureFlag.findMany({
    where: {
      ...(opts?.category ? { category: opts.category } : {}),
      ...(opts?.enabled !== undefined ? { enabled: opts.enabled } : {}),
    },
    orderBy: { category: 'asc' },
  })
  return rows.map(mapFlag)
}

/**
 * Resolve whether a flag is ON for a given tenant context.
 * Order: enabled flag → plan targeting → tenant targeting → org targeting → rollout %.
 */
export function evaluateFlag(
  flag: FeatureFlagRecord,
  ctx: { tenantId: string; planKey: string; orgId?: string },
): boolean {
  if (!flag.enabled) return false
  // Plan targeting — if specified and tenant plan not included, off
  if (flag.targetPlanKeys.length > 0 && !flag.targetPlanKeys.includes(ctx.planKey)) return false
  // Tenant targeting — if specified and tenant not included, off
  if (flag.targetTenantIds.length > 0 && !flag.targetTenantIds.includes(ctx.tenantId)) return false
  // Org targeting — if specified and org not included, off
  if (flag.targetOrgIds.length > 0 && (!ctx.orgId || !flag.targetOrgIds.includes(ctx.orgId))) return false
  // Rollout percentage — deterministic hash of tenantId+flagKey → 0..99
  if (flag.rolloutPct < 100) {
    const hash = stableHash(`${ctx.tenantId}:${flag.key}`)
    if (hash >= flag.rolloutPct) return false
  }
  return true
}

/** Deterministic 0-99 hash so rollout is stable per tenant+flag. */
function stableHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h) % 100
}

export async function getFlagStats(): Promise<FeatureFlagStats> {
  const [total, enabled, byCategoryRaw] = await Promise.all([
    db.featureFlag.count(),
    db.featureFlag.count({ where: { enabled: true } }),
    db.featureFlag.groupBy({ by: ['category'], _count: { _all: true } }),
  ])
  const enabledByCat = await db.featureFlag.groupBy({ by: ['category'], where: { enabled: true }, _count: { _all: true } })
  const enabledMap = new Map(enabledByCat.map((g) => [g.category, g._count._all]))
  return {
    total,
    enabled,
    disabled: total - enabled,
    byCategory: byCategoryRaw.map((g) => ({
      category: g.category,
      total: g._count._all,
      enabled: enabledMap.get(g.category) ?? 0,
    })),
  }
}

export async function toggleFlag(flagKey: string, enabled: boolean): Promise<FeatureFlagRecord> {
  const updated = await db.featureFlag.update({ where: { key: flagKey }, data: { enabled } })
  return mapFlag(updated)
}

export async function setRollout(flagKey: string, rolloutPct: number): Promise<FeatureFlagRecord> {
  const pct = Math.max(0, Math.min(100, Math.round(rolloutPct)))
  const updated = await db.featureFlag.update({ where: { key: flagKey }, data: { rolloutPct: pct } })
  return mapFlag(updated)
}

export async function ensureDefaultFlags(): Promise<void> {
  const existing = await db.featureFlag.count()
  if (existing > 0) return
  await db.featureFlag.createMany({
    data: DEFAULT_FLAGS.map((f) => ({
      key: f.key, name: f.name, description: f.description, category: f.category,
      enabled: f.enabled, rolloutPct: f.rolloutPct,
      targetTenantIds: JSON.stringify(f.targetTenantIds),
      targetPlanKeys: JSON.stringify(f.targetPlanKeys),
      targetOrgIds: JSON.stringify(f.targetOrgIds),
      metadata: f.metadata ? JSON.stringify(f.metadata) : null,
    })),
  })
}
