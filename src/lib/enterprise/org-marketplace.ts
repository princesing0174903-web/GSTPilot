/**
 * Organization Marketplace™ — install industry modules per organization.
 *
 * Modules (Manufacturing, Retail, Healthcare, Education, Construction,
 * Hospitality, CA Practice, Legal, Export, Distribution) auto-connect to
 * AI CEO™, AI Workforce™, Business Graph™, Digital Twin™, Automation™ and
 * Knowledge Graph™ when installed.
 *
 * Tenant-scoped. Zero cross-tenant data leakage.
 */
import { db } from '@/lib/db'

export interface ModuleDefinition {
  key: string
  name: string
  description: string
  category: string
  icon: string
  capabilities: string[]
  autoConnect: string[] // engines that auto-wire on install
  defaultConfig: Record<string, unknown>
}

export interface InstalledModuleRecord {
  id: string
  organizationId: string | null
  moduleKey: string
  name: string
  description: string | null
  category: string
  status: string
  config: Record<string, unknown>
  autoConnect: string[]
  installedAt: string
  updatedAt: string
}

/** The 10 industry modules available in the marketplace. */
export const MODULE_CATALOG: ModuleDefinition[] = [
  {
    key: 'manufacturing',
    name: 'Manufacturing Module',
    description: 'Production planning, BOM, work orders, quality control, shop floor',
    category: 'industry',
    icon: 'Factory',
    capabilities: ['Bill of Materials', 'Work Orders', 'Production Planning', 'Quality Control', 'Costing', 'Inventory Valuation'],
    autoConnect: ['ai_ceo', 'ai_workforce', 'business_graph', 'digital_twin', 'automation', 'knowledge_graph'],
    defaultConfig: { costingMethod: 'FIFO', shiftsPerDay: 3 },
  },
  {
    key: 'retail',
    name: 'Retail Module',
    description: 'POS, multi-store inventory, loyalty, customer experience',
    category: 'industry',
    icon: 'ShoppingCart',
    capabilities: ['Point of Sale', 'Multi-Store Inventory', 'Loyalty Program', 'Customer Experience', 'Promotions', 'Stock Replenishment'],
    autoConnect: ['ai_ceo', 'ai_workforce', 'business_graph', 'digital_twin', 'automation', 'knowledge_graph'],
    defaultConfig: { storeCount: 1, loyaltyEnabled: true },
  },
  {
    key: 'healthcare',
    name: 'Healthcare Module',
    description: 'Patient records, billing, insurance claims, HIPAA compliance',
    category: 'industry',
    icon: 'HeartPulse',
    capabilities: ['Patient Management', 'Insurance Claims', 'Medical Billing', 'Appointment Scheduling', 'HIPAA Compliance', 'Inventory'],
    autoConnect: ['ai_ceo', 'ai_workforce', 'business_graph', 'digital_twin', 'automation', 'knowledge_graph'],
    defaultConfig: { hipaaMode: true, claimAutoSubmit: false },
  },
  {
    key: 'education',
    name: 'Education Module',
    description: 'Admissions, fees, attendance, results, parent portal',
    category: 'industry',
    icon: 'GraduationCap',
    capabilities: ['Admissions', 'Fee Management', 'Attendance', 'Exams & Results', 'Parent Portal', 'Staff Payroll'],
    autoConnect: ['ai_ceo', 'ai_workforce', 'business_graph', 'digital_twin', 'automation', 'knowledge_graph'],
    defaultConfig: { academicYear: '2025-26', terms: 2 },
  },
  {
    key: 'construction',
    name: 'Construction Module',
    description: 'Projects, BOQ, contractors, progress billing, site management',
    category: 'industry',
    icon: 'HardHat',
    capabilities: ['Project Management', 'Bill of Quantities', 'Contractor Management', 'Progress Billing', 'Site Reports', 'Equipment Tracking'],
    autoConnect: ['ai_ceo', 'ai_workforce', 'business_graph', 'digital_twin', 'automation', 'knowledge_graph'],
    defaultConfig: { projectAccounting: true },
  },
  {
    key: 'hospitality',
    name: 'Hospitality Module',
    description: 'Reservations, front desk, F&B, housekeeping, channel manager',
    category: 'industry',
    icon: 'BedDouble',
    capabilities: ['Reservations', 'Front Desk', 'F&B POS', 'Housekeeping', 'Channel Manager', 'Guest Experience'],
    autoConnect: ['ai_ceo', 'ai_workforce', 'business_graph', 'digital_twin', 'automation', 'knowledge_graph'],
    defaultConfig: { roomCount: 50, channels: ['booking', 'expedia'] },
  },
  {
    key: 'ca_practice',
    name: 'CA Practice Module',
    description: 'Client management, multi-entity filing, due dates, billing',
    category: 'industry',
    icon: 'Calculator',
    capabilities: ['Client Management', 'Multi-Entity Filing', 'Due Date Tracker', 'Timesheet Billing', 'Document Vault', 'Notice Management'],
    autoConnect: ['ai_ceo', 'ai_workforce', 'business_graph', 'digital_twin', 'automation', 'knowledge_graph'],
    defaultConfig: { clientCount: 0, billingCycle: 'monthly' },
  },
  {
    key: 'legal',
    name: 'Legal Practice Module',
    description: 'Matters, time tracking, billing, e-discovery, contracts',
    category: 'industry',
    icon: 'Scale',
    capabilities: ['Matter Management', 'Time Tracking', 'Legal Billing', 'E-Discovery', 'Contract Lifecycle', 'Court Calendar'],
    autoConnect: ['ai_ceo', 'ai_workforce', 'business_graph', 'digital_twin', 'automation', 'knowledge_graph'],
    defaultConfig: { matterNumbering: 'sequential' },
  },
  {
    key: 'export',
    name: 'Export Business Module',
    description: 'Export documentation, LUT, shipping, forex, drawback claims',
    category: 'industry',
    icon: 'Ship',
    capabilities: ['Export Documentation', 'LUT Management', 'Shipping & Logistics', 'Forex Management', 'Drawback Claims', 'MEIS/RoDTEP'],
    autoConnect: ['ai_ceo', 'ai_workforce', 'business_graph', 'digital_twin', 'automation', 'knowledge_graph'],
    defaultConfig: { defaultCurrency: 'USD', lutValid: true },
  },
  {
    key: 'distribution',
    name: 'Distribution Module',
    description: 'Multi-tier distribution, schemes, secondary sales, claims',
    category: 'industry',
    icon: 'Truck',
    capabilities: ['Distributor Management', 'Secondary Sales', 'Scheme Management', 'Claim Processing', 'Route Planning', 'Stockist Billing'],
    autoConnect: ['ai_ceo', 'ai_workforce', 'business_graph', 'digital_twin', 'automation', 'knowledge_graph'],
    defaultConfig: { tiers: 3 },
  },
]

export function browseCatalog(): ModuleDefinition[] {
  return MODULE_CATALOG
}

function mapModule(r: {
  id: string; organizationId: string | null; moduleKey: string; name: string; description: string | null;
  category: string; status: string; config: string; autoConnect: string; installedAt: Date; updatedAt: Date;
}): InstalledModuleRecord {
  let config: Record<string, unknown> = {}
  let autoConnect: string[] = []
  try { config = JSON.parse(r.config) as Record<string, unknown> } catch { /* empty */ }
  try { autoConnect = JSON.parse(r.autoConnect) as string[] } catch { /* empty */ }
  return {
    id: r.id, organizationId: r.organizationId, moduleKey: r.moduleKey, name: r.name,
    description: r.description, category: r.category, status: r.status, config, autoConnect,
    installedAt: r.installedAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  }
}

export async function listModules(tenantId: string): Promise<InstalledModuleRecord[]> {
  const rows = await db.orgModule.findMany({ where: { tenantId }, orderBy: { installedAt: 'desc' } })
  return rows.map(mapModule)
}

export async function installModule(
  tenantId: string,
  moduleKey: string,
  organizationId?: string,
): Promise<InstalledModuleRecord> {
  const def = MODULE_CATALOG.find((m) => m.key === moduleKey)
  if (!def) throw new Error(`Unknown module: ${moduleKey}`)
  const existing = await db.orgModule.findFirst({ where: { tenantId, moduleKey, organizationId: organizationId ?? null } })
  if (existing) return mapModule(existing)
  const created = await db.orgModule.create({
    data: {
      tenantId,
      organizationId: organizationId ?? null,
      moduleKey: def.key,
      name: def.name,
      description: def.description,
      category: def.category,
      status: 'installed',
      config: JSON.stringify(def.defaultConfig),
      autoConnect: JSON.stringify(def.autoConnect),
    },
  })
  return mapModule(created)
}

export async function uninstallModule(tenantId: string, moduleKey: string): Promise<{ ok: true }> {
  await db.orgModule.deleteMany({ where: { tenantId, moduleKey } })
  return { ok: true }
}

export async function pauseModule(tenantId: string, moduleKey: string): Promise<InstalledModuleRecord | null> {
  const updated = await db.orgModule.updateMany({ where: { tenantId, moduleKey }, data: { status: 'paused' } })
  if (updated.count === 0) return null
  const r = await db.orgModule.findFirst({ where: { tenantId, moduleKey } })
  return r ? mapModule(r) : null
}

export async function getModuleStats(tenantId: string): Promise<{
  installed: number
  active: number
  paused: number
  catalogTotal: number
  autoConnectedEngines: string[]
}> {
  const [installed, active, paused] = await Promise.all([
    db.orgModule.count({ where: { tenantId } }),
    db.orgModule.count({ where: { tenantId, status: 'installed' } }),
    db.orgModule.count({ where: { tenantId, status: 'paused' } }),
  ])
  const rows = await db.orgModule.findMany({ where: { tenantId, status: 'installed' }, select: { autoConnect: true } })
  const engines = new Set<string>()
  for (const r of rows) {
    try {
      const arr = JSON.parse(r.autoConnect) as string[]
      arr.forEach((e) => engines.add(e))
    } catch { /* empty */ }
  }
  return { installed, active, paused, catalogTotal: MODULE_CATALOG.length, autoConnectedEngines: [...engines] }
}
