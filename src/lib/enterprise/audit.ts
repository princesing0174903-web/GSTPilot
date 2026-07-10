/**
 * Enterprise Audit Engine™ — tracks every action across users, AI employees,
 * AI CEO, automation, API, integrations, approvals, logins & files.
 */
import { db } from '@/lib/db'
import type { AuditActorType } from './types'

export interface AuditLogInput {
  tenantId: string
  actorType: AuditActorType
  actorId?: string | null
  actorName?: string | null
  action: string
  entity?: string | null
  entityId?: string | null
  summary: string
  severity?: 'info' | 'warning' | 'critical'
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Record<string, unknown> | null
}

export async function logAudit(input: AuditLogInput) {
  try {
    return await db.enterpriseAuditLog.create({
      data: {
        tenantId: input.tenantId,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
        action: input.action,
        entity: input.entity ?? null,
        entityId: input.entityId ?? null,
        summary: input.summary,
        severity: input.severity ?? 'info',
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    })
  } catch (err) {
    console.error('[enterprise:audit] failed to log:', err)
    return null
  }
}

export async function listAuditLogs(tenantId: string, opts: {
  take?: number
  actorType?: string
  action?: string
  severity?: string
} = {}) {
  const { take = 100, actorType, action, severity } = opts
  const where: Record<string, unknown> = { tenantId }
  if (actorType) where.actorType = actorType
  if (action) where.action = action
  if (severity) where.severity = severity
  const rows = await db.enterpriseAuditLog.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take,
  })
  return rows.map((r) => ({
    id: r.id,
    actorType: r.actorType,
    actorId: r.actorId,
    actorName: r.actorName,
    action: r.action,
    entity: r.entity,
    entityId: r.entityId,
    summary: r.summary,
    severity: r.severity,
    ipAddress: r.ipAddress,
    timestamp: r.timestamp.toISOString(),
    metadata: r.metadata ? safeParse(r.metadata) : null,
  }))
}

export async function getAuditStats(tenantId: string) {
  const since = new Date()
  since.setDate(since.getDate() - 1)
  const last24h = await db.enterpriseAuditLog.count({ where: { tenantId, timestamp: { gte: since } } })
  const byActor = await db.enterpriseAuditLog.groupBy({
    by: ['actorType'],
    where: { tenantId },
    _count: true,
  })
  const byAction = await db.enterpriseAuditLog.groupBy({
    by: ['action'],
    where: { tenantId },
    _count: true,
    orderBy: { _count: { action: 'desc' } },
    take: 10,
  })
  const critical = await db.enterpriseAuditLog.count({ where: { tenantId, severity: 'critical' } })
  return {
    total: await db.enterpriseAuditLog.count({ where: { tenantId } }),
    last24h,
    critical,
    byActor: byActor.map((b) => ({ actorType: b.actorType, count: b._count })),
    byAction: byAction.map((b) => ({ action: b.action, count: b._count })),
  }
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s) } catch { return null }
}
