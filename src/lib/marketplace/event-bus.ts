// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Global Integration Marketplace™ — Event Bus™
// Publish events from every connector. AI CEO™, AI Workforce™, Automation™,
// and Oracle™ consume these events automatically.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import { resolveTenantId } from '@/lib/enterprise/tenant'
import type { IntegrationEventDTO } from './types'

/** Publish an event onto the Event Bus. */
export async function publishEvent(opts: {
  tenantId?: string
  connectorSlug: string
  installedIntegrationId?: string
  eventType: string
  source: string
  severity?: 'info' | 'warning' | 'critical'
  payload?: Record<string, unknown>
}): Promise<string> {
  const tenantId = opts.tenantId ?? (await resolveTenantId())
  const created = await db.integrationEvent.create({
    data: {
      tenantId,
      installedIntegrationId: opts.installedIntegrationId ?? null,
      connectorSlug: opts.connectorSlug,
      eventType: opts.eventType,
      source: opts.source,
      severity: opts.severity ?? 'info',
      payload: JSON.stringify(opts.payload ?? {}),
      consumed: false,
    },
  })
  return created.id
}

/** List recent events on the Event Bus (optionally filtered). */
export async function listEvents(opts: {
  limit?: number
  connectorSlug?: string
  eventType?: string
  consumed?: boolean
  severity?: string
} = {}): Promise<IntegrationEventDTO[]> {
  const tenantId = await resolveTenantId()
  const limit = Math.min(opts.limit ?? 100, 500)

  const where: Record<string, unknown> = { tenantId }
  if (opts.connectorSlug) where.connectorSlug = opts.connectorSlug
  if (opts.eventType) where.eventType = opts.eventType
  if (opts.consumed !== undefined) where.consumed = opts.consumed
  if (opts.severity) where.severity = opts.severity

  const rows = await db.integrationEvent.findMany({
    where,
    orderBy: { publishedAt: 'desc' },
    take: limit,
  })

  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    connectorSlug: r.connectorSlug,
    eventType: r.eventType,
    source: r.source,
    severity: r.severity as 'info' | 'warning' | 'critical',
    payload: r.payload ? JSON.parse(r.payload) : {},
    consumed: r.consumed,
    consumedBy: r.consumedBy,
    publishedAt: r.publishedAt.toISOString(),
  }))
}

/** Mark an event as consumed by a consumer (ai-ceo / ai-workforce / oracle / automation). */
export async function consumeEvent(eventId: string, consumedBy: string): Promise<void> {
  await db.integrationEvent.update({
    where: { id: eventId },
    data: { consumed: true, consumedBy },
  })
}

/** Aggregate event stats for the dashboard. */
export async function eventBusStats(): Promise<{
  total: number
  lastHour: number
  last24h: number
  consumed: number
  unconsumed: number
  byEventType: { eventType: string; count: number }[]
  byConnector: { connectorSlug: string; count: number }[]
}> {
  const tenantId = await resolveTenantId()
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [total, lastHour, last24h, consumed, unconsumed, byType, byConn] = await Promise.all([
    db.integrationEvent.count({ where: { tenantId } }),
    db.integrationEvent.count({ where: { tenantId, publishedAt: { gte: oneHourAgo } } }),
    db.integrationEvent.count({ where: { tenantId, publishedAt: { gte: oneDayAgo } } }),
    db.integrationEvent.count({ where: { tenantId, consumed: true } }),
    db.integrationEvent.count({ where: { tenantId, consumed: false } }),
    db.integrationEvent.groupBy({ by: ['eventType'], where: { tenantId }, _count: { _all: true }, orderBy: { _count: { eventType: 'desc' } }, take: 12 }),
    db.integrationEvent.groupBy({ by: ['connectorSlug'], where: { tenantId }, _count: { _all: true }, orderBy: { _count: { connectorSlug: 'desc' } }, take: 12 }),
  ])

  return {
    total,
    lastHour,
    last24h,
    consumed,
    unconsumed,
    byEventType: byType.map((t) => ({ eventType: t.eventType, count: t._count._all })),
    byConnector: byConn.map((c) => ({ connectorSlug: c.connectorSlug, count: c._count._all })),
  }
}
