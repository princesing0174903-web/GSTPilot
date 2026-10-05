/**
 * Enterprise Policy Engine™ — all AI & business actions validated before execution.
 *
 * Policies (invoice approval > ₹5L, loan approval, GST filing, vendor onboarding,
 * expense approval, AI execution limits, security rules, retention, compliance)
 * gate every significant action. When a policy's threshold is met a PolicyApproval
 * is raised; the action only proceeds once the required approver roles have signed off.
 *
 * Tenant-scoped. Zero cross-tenant data leakage.
 */
import { db } from '@/lib/db'

export interface PolicyRecord {
  id: string
  key: string
  name: string
  description: string | null
  category: string
  appliesTo: string
  rules: {
    threshold?: number
    currency?: string
    approvers?: string[]
    minApprovers?: number
    aiLimitPerDay?: number
    retentionDays?: number
    [k: string]: unknown
  }
  severity: string
  status: string
  createdByUserId: string | null
  createdAt: string
  updatedAt: string
}

export interface PolicyApprovalRecord {
  id: string
  policyId: string
  policyName: string
  policyKey: string
  entityType: string
  entityId: string
  summary: string
  amount: number | null
  currency: string
  requestedByType: string
  requestedByName: string | null
  approverRoles: string[]
  decisions: { role: string; userId: string | null; decision: string; comment: string | null; decidedAt: string }[]
  status: string
  createdAt: string
  decidedAt: string | null
}

export interface ValidationResult {
  requiresApproval: boolean
  policyId: string | null
  policyKey: string | null
  reason: string
  severity: string
}

function parseRules(raw: string): PolicyRecord['rules'] {
  try {
    return JSON.parse(raw) as PolicyRecord['rules']
  } catch {
    return {}
  }
}

export async function listPolicies(
  tenantId: string,
  opts?: { status?: string; appliesTo?: string },
): Promise<PolicyRecord[]> {
  const rows = await db.policy.findMany({
    where: {
      tenantId,
      ...(opts?.status ? { status: opts.status } : {}),
      ...(opts?.appliesTo ? { appliesTo: opts.appliesTo } : {}),
    },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map((r) => ({
    id: r.id, key: r.key, name: r.name, description: r.description,
    category: r.category, appliesTo: r.appliesTo, rules: parseRules(r.rules),
    severity: r.severity, status: r.status, createdByUserId: r.createdByUserId,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  }))
}

export async function getPolicy(tenantId: string, policyId: string): Promise<PolicyRecord | null> {
  const r = await db.policy.findFirst({ where: { id: policyId, tenantId } })
  if (!r) return null
  return {
    id: r.id, key: r.key, name: r.name, description: r.description,
    category: r.category, appliesTo: r.appliesTo, rules: parseRules(r.rules),
    severity: r.severity, status: r.status, createdByUserId: r.createdByUserId,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  }
}

/**
 * Core gate — call before any significant AI or business action executes.
 * Returns requiresApproval=true when the action crosses an active policy threshold.
 */
export async function validateAction(
  tenantId: string,
  action: { entityType: string; entityId?: string; amount?: number; requestedByType?: string },
): Promise<ValidationResult> {
  const policies = await listPolicies(tenantId, { status: 'active', appliesTo: action.entityType })
  for (const p of policies) {
    const threshold = p.rules.threshold
    if (typeof threshold === 'number' && typeof action.amount === 'number' && action.amount >= threshold) {
      return {
        requiresApproval: true,
        policyId: p.id,
        policyKey: p.key,
        reason: `${p.name}: amount ₹${action.amount.toLocaleString('en-IN')} meets threshold ₹${threshold.toLocaleString('en-IN')}`,
        severity: p.severity,
      }
    }
    // AI execution limit — gates AI CEO/Workforce actions by daily cap
    if (p.rules.aiLimitPerDay !== undefined && action.requestedByType && action.requestedByType.startsWith('ai')) {
      return {
        requiresApproval: true,
        policyId: p.id,
        policyKey: p.key,
        reason: `${p.name}: AI action requires approval (limit ${p.rules.aiLimitPerDay}/day)`,
        severity: p.severity,
      }
    }
    // No threshold but active policy on this entity → approval required
    if (threshold === undefined && p.rules.aiLimitPerDay === undefined) {
      return {
        requiresApproval: true,
        policyId: p.id,
        policyKey: p.key,
        reason: `${p.name}: action on ${action.entityType} requires approval`,
        severity: p.severity,
      }
    }
  }
  return { requiresApproval: false, policyId: null, policyKey: null, reason: 'No policy threshold met', severity: 'low' }
}

export async function createApprovalRequest(
  tenantId: string,
  data: {
    policyId: string
    entityType: string
    entityId: string
    summary: string
    amount?: number
    currency?: string
    requestedByType?: string
    requestedByUserId?: string
    requestedByName?: string
  },
): Promise<PolicyApprovalRecord> {
  const policy = await getPolicy(tenantId, data.policyId)
  if (!policy) throw new Error('Policy not found')
  const approverRoles = policy.rules.approvers ?? ['ceo', 'cfo']
  const created = await db.policyApproval.create({
    data: {
      tenantId,
      policyId: data.policyId,
      entityType: data.entityType,
      entityId: data.entityId,
      summary: data.summary,
      amount: data.amount ?? null,
      currency: data.currency ?? 'INR',
      requestedByType: data.requestedByType ?? 'user',
      requestedByUserId: data.requestedByUserId ?? null,
      requestedByName: data.requestedByName ?? null,
      approverRoles: JSON.stringify(approverRoles),
      decisions: '[]',
      status: 'pending',
    },
  })
  return mapApproval(created, policy.name, policy.key)
}

export async function listApprovals(
  tenantId: string,
  opts?: { status?: string; entityType?: string; take?: number },
): Promise<PolicyApprovalRecord[]> {
  const rows = await db.policyApproval.findMany({
    where: {
      tenantId,
      ...(opts?.status ? { status: opts.status } : {}),
      ...(opts?.entityType ? { entityType: opts.entityType } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: opts?.take ?? 50,
    include: { policy: { select: { name: true, key: true } } },
  })
  return rows.map((r) => mapApproval(r, r.policy.name, r.policy.key))
}

function mapApproval(
  r: { id: string; policyId: string; entityType: string; entityId: string; summary: string; amount: number | null; currency: string; requestedByType: string; requestedByName: string | null; approverRoles: string; decisions: string; status: string; createdAt: Date; decidedAt: Date | null },
  policyName: string,
  policyKey: string,
): PolicyApprovalRecord {
  let decisions: PolicyApprovalRecord['decisions'] = []
  let approverRoles: string[] = []
  try {
    decisions = JSON.parse(r.decisions) as PolicyApprovalRecord['decisions']
  } catch { /* empty */ }
  try {
    approverRoles = JSON.parse(r.approverRoles) as string[]
  } catch { /* empty */ }
  return {
    id: r.id, policyId: r.policyId, policyName, policyKey,
    entityType: r.entityType, entityId: r.entityId, summary: r.summary,
    amount: r.amount, currency: r.currency, requestedByType: r.requestedByType,
    requestedByName: r.requestedByName, approverRoles, decisions,
    status: r.status, createdAt: r.createdAt.toISOString(), decidedAt: r.decidedAt?.toISOString() ?? null,
  }
}

export async function decideApproval(
  tenantId: string,
  approvalId: string,
  decision: 'approved' | 'rejected',
  voter: { role: string; userId?: string; comment?: string },
): Promise<PolicyApprovalRecord> {
  const approval = await db.policyApproval.findFirst({ where: { id: approvalId, tenantId }, include: { policy: true } })
  if (!approval) throw new Error('Approval not found')
  if (approval.status !== 'pending') throw new Error(`Approval already ${approval.status}`)

  let approverRoles: string[] = []
  try { approverRoles = JSON.parse(approval.approverRoles) as string[] } catch { /* empty */ }
  if (!approverRoles.includes(voter.role)) {
    throw new Error(`Role "${voter.role}" is not an approver for this policy`)
  }

  let decisions: { role: string; userId: string | null; decision: string; comment: string | null; decidedAt: string }[] = []
  try { decisions = JSON.parse(approval.decisions) as typeof decisions } catch { /* empty */ }
  decisions.push({
    role: voter.role,
    userId: voter.userId ?? null,
    decision,
    comment: voter.comment ?? null,
    decidedAt: new Date().toISOString(),
  })

  let minApprovers = 1
  try {
    const rules = JSON.parse(approval.policy.rules) as { minApprovers?: number }
    minApprovers = rules.minApprovers ?? 1
  } catch { /* empty */ }

  const approvals = decisions.filter((d) => d.decision === 'approved').length
  const rejections = decisions.filter((d) => d.decision === 'rejected').length
  let newStatus = 'pending'
  let decidedAt: Date | null = null
  if (rejections > 0) {
    newStatus = 'rejected'
    decidedAt = new Date()
  } else if (approvals >= minApprovers) {
    newStatus = 'approved'
    decidedAt = new Date()
  }

  const updated = await db.policyApproval.update({
    where: { id: approvalId },
    data: {
      decisions: JSON.stringify(decisions),
      status: newStatus,
      decidedAt,
    },
    include: { policy: { select: { name: true, key: true } } },
  })
  return mapApproval(updated, updated.policy.name, updated.policy.key)
}

export async function getPolicyStats(tenantId: string): Promise<{
  total: number
  active: number
  pendingApprovals: number
  approved24h: number
  rejected24h: number
  byCategory: { category: string; count: number }[]
}> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [total, active, pending, approved24h, rejected24h, byCategoryRaw] = await Promise.all([
    db.policy.count({ where: { tenantId } }),
    db.policy.count({ where: { tenantId, status: 'active' } }),
    db.policyApproval.count({ where: { tenantId, status: 'pending' } }),
    db.policyApproval.count({ where: { tenantId, status: 'approved', decidedAt: { gte: since } } }),
    db.policyApproval.count({ where: { tenantId, status: 'rejected', decidedAt: { gte: since } } }),
    db.policy.groupBy({ by: ['category'], where: { tenantId }, _count: { _all: true } }),
  ])
  return {
    total, active, pendingApprovals: pending, approved24h, rejected24h,
    byCategory: byCategoryRaw.map((g) => ({ category: g.category, count: g._count._all })),
  }
}
