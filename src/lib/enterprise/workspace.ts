/**
 * Enterprise Workspace™ — multiple role-based workspaces per tenant.
 *
 * Each workspace (Finance, Sales, Marketing, Compliance, Operations, Executive)
 * bundles its own widgets, saved views, filters, shortcuts and permissions.
 * Tenant-scoped. Default workspaces are seeded idempotently on first access.
 */
import { db } from '@/lib/db'

export interface WorkspaceWidget {
  type: string
  title: string
  config?: Record<string, unknown>
}
export interface WorkspaceSavedView {
  name: string
  filters: Record<string, unknown>
  columns?: string[]
}
export interface WorkspaceShortcut {
  label: string
  path: string
  icon?: string
}

export interface WorkspaceRecord {
  id: string
  key: string
  name: string
  description: string | null
  organizationId: string | null
  ownerId: string | null
  widgets: WorkspaceWidget[]
  savedViews: WorkspaceSavedView[]
  shortcuts: WorkspaceShortcut[]
  filters: Record<string, unknown>
  permissions: string[]
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface WorkspaceDefinition {
  key: string
  name: string
  description: string
  isDefault: boolean
  permissions: string[]
  widgets: WorkspaceWidget[]
  savedViews: WorkspaceSavedView[]
  shortcuts: WorkspaceShortcut[]
  filters: Record<string, unknown>
}

/** The 6 default enterprise workspaces. */
export const DEFAULT_WORKSPACES: WorkspaceDefinition[] = [
  {
    key: 'finance',
    name: 'Finance Workspace',
    description: 'Cash flow, invoices, payments, banking, AI CFO™',
    isDefault: true,
    permissions: ['cfo', 'ceo', 'owner', 'ca', 'auditor'],
    widgets: [
      { type: 'cash_flow', title: 'Cash Flow Forecast' },
      { type: 'health_score', title: 'Financial Health Score' },
      { type: 'receivables', title: 'Receivables Aging' },
      { type: 'payables', title: 'Payables Aging' },
      { type: 'gst_liability', title: 'GST Liability' },
      { type: 'ai_cfo', title: 'AI CFO Insights' },
    ],
    savedViews: [
      { name: 'Overdue Invoices', filters: { status: 'overdue' } },
      { name: 'High-Value Payments', filters: { minAmount: 100000 } },
      { name: 'This Quarter GST', filters: { period: 'quarter' } },
    ],
    shortcuts: [
      { label: 'Create Invoice', path: '/invoices/new', icon: 'FilePlus' },
      { label: 'Reconcile Bank', path: '/reconciliation', icon: 'Landmark' },
      { label: 'File GST', path: '/returns', icon: 'FileText' },
    ],
    filters: { period: 'month', currency: 'INR' },
  },
  {
    key: 'sales',
    name: 'Sales Workspace',
    description: 'Pipeline, leads, deals, CRM, forecasts',
    isDefault: false,
    permissions: ['ceo', 'coo', 'manager', 'employee'],
    widgets: [
      { type: 'pipeline', title: 'Sales Pipeline' },
      { type: 'leads', title: 'Hot Leads' },
      { type: 'deals', title: 'Open Deals' },
      { type: 'quota', title: 'Quota Attainment' },
      { type: 'forecast', title: 'Revenue Forecast' },
    ],
    savedViews: [
      { name: 'Hot Leads', filters: { score: 'hot' } },
      { name: 'Closing This Month', filters: { closeDate: 'this_month' } },
    ],
    shortcuts: [
      { label: 'New Lead', path: '/crm/leads/new', icon: 'UserPlus' },
      { label: 'Pipeline', path: '/crm', icon: 'TrendingUp' },
    ],
    filters: { owner: 'me', stage: 'all' },
  },
  {
    key: 'marketing',
    name: 'Marketing Workspace',
    description: 'Campaigns, analytics, attribution, AI Marketing',
    isDefault: false,
    permissions: ['cmo', 'ceo', 'manager'],
    widgets: [
      { type: 'campaigns', title: 'Active Campaigns' },
      { type: 'attribution', title: 'Multi-Touch Attribution' },
      { type: 'reach', title: 'Reach & Engagement' },
      { type: 'roi', title: 'Marketing ROI' },
    ],
    savedViews: [{ name: 'Top Campaigns', filters: { sortBy: 'roi' } }],
    shortcuts: [{ label: 'New Campaign', path: '/marketing/new', icon: 'Megaphone' }],
    filters: { channel: 'all' },
  },
  {
    key: 'compliance',
    name: 'Compliance Workspace',
    description: 'GST filings, audit trail, notices, ROC, legal',
    isDefault: false,
    permissions: ['ca', 'auditor', 'ceo', 'cfo'],
    widgets: [
      { type: 'gst_calendar', title: 'GST Filing Calendar' },
      { type: 'notices', title: 'Active Notices' },
      { type: 'audit_trail', title: 'Audit Trail' },
      { type: 'roc', title: 'ROC Compliance' },
      { type: 'tds', title: 'TDS Dashboard' },
    ],
    savedViews: [
      { name: 'Due This Week', filters: { dueIn: '7d' } },
      { name: 'Overdue', filters: { status: 'overdue' } },
    ],
    shortcuts: [
      { label: 'File GSTR', path: '/gstr', icon: 'FileText' },
      { label: 'Notices', path: '/notices', icon: 'AlertTriangle' },
    ],
    filters: { period: 'month', status: 'all' },
  },
  {
    key: 'operations',
    name: 'Operations Workspace',
    description: 'Automation, workforce, tasks, inventory, logistics',
    isDefault: false,
    permissions: ['coo', 'ceo', 'manager', 'employee'],
    widgets: [
      { type: 'automation', title: 'Active Automations' },
      { type: 'workforce', title: 'AI Workforce Status' },
      { type: 'tasks', title: 'Task Board' },
      { type: 'inventory', title: 'Inventory Levels' },
    ],
    savedViews: [{ name: 'My Tasks', filters: { assignee: 'me' } }],
    shortcuts: [{ label: 'Automations', path: '/automation', icon: 'Zap' }],
    filters: { status: 'active' },
  },
  {
    key: 'executive',
    name: 'Executive Workspace',
    description: 'AI CEO brief, KPIs, strategy, board view, Digital Twin',
    isDefault: false,
    permissions: ['ceo', 'cfo', 'coo', 'cto', 'owner'],
    widgets: [
      { type: 'ceo_brief', title: 'Daily CEO Brief' },
      { type: 'kpi_summary', title: 'Executive KPIs' },
      { type: 'digital_twin', title: 'Digital Twin' },
      { type: 'strategy', title: 'Strategic Goals' },
      { type: 'board', title: 'Board View' },
    ],
    savedViews: [{ name: 'Today', filters: { period: 'today' } }],
    shortcuts: [{ label: 'AI CEO', path: '/ai-ceo', icon: 'Crown' }],
    filters: { period: 'today' },
  },
]

function mapWorkspace(r: {
  id: string; key: string; name: string; description: string | null; organizationId: string | null;
  ownerId: string | null; widgets: string; savedViews: string; shortcuts: string; filters: string;
  permissions: string; isDefault: boolean; createdAt: Date; updatedAt: Date;
}): WorkspaceRecord {
  let widgets: WorkspaceWidget[] = []
  let savedViews: WorkspaceSavedView[] = []
  let shortcuts: WorkspaceShortcut[] = []
  let filters: Record<string, unknown> = {}
  let permissions: string[] = []
  try { widgets = JSON.parse(r.widgets) as WorkspaceWidget[] } catch { /* empty */ }
  try { savedViews = JSON.parse(r.savedViews) as WorkspaceSavedView[] } catch { /* empty */ }
  try { shortcuts = JSON.parse(r.shortcuts) as WorkspaceShortcut[] } catch { /* empty */ }
  try { filters = JSON.parse(r.filters) as Record<string, unknown> } catch { /* empty */ }
  try { permissions = JSON.parse(r.permissions) as string[] } catch { /* empty */ }
  return {
    id: r.id, key: r.key, name: r.name, description: r.description,
    organizationId: r.organizationId, ownerId: r.ownerId, widgets, savedViews,
    shortcuts, filters, permissions, isDefault: r.isDefault,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  }
}

export async function listWorkspaces(tenantId: string): Promise<WorkspaceRecord[]> {
  const rows = await db.workspace.findMany({ where: { tenantId }, orderBy: { isDefault: 'desc' } })
  return rows.map(mapWorkspace)
}

export async function getWorkspace(tenantId: string, key: string): Promise<WorkspaceRecord | null> {
  const r = await db.workspace.findFirst({ where: { tenantId, key } })
  return r ? mapWorkspace(r) : null
}

export async function ensureDefaultWorkspaces(tenantId: string): Promise<void> {
  const existing = await db.workspace.count({ where: { tenantId } })
  if (existing > 0) return
  await db.workspace.createMany({
    data: DEFAULT_WORKSPACES.map((w) => ({
      tenantId,
      key: w.key,
      name: w.name,
      description: w.description,
      widgets: JSON.stringify(w.widgets),
      savedViews: JSON.stringify(w.savedViews),
      shortcuts: JSON.stringify(w.shortcuts),
      filters: JSON.stringify(w.filters),
      permissions: JSON.stringify(w.permissions),
      isDefault: w.isDefault,
    })),
  })
}
