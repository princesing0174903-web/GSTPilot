// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Global Integration Marketplace™ — AI Connector Engine™
// Oracle automatically understands connected apps and executes natural-language
// commands using connected APIs.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import { resolveTenantId } from '@/lib/enterprise/tenant'
import { AI_CONNECTOR_INTENTS } from './types'
import type { AIConnectorIntent } from './types'

/** Parse a natural-language command and match it to a connector + action. */
export async function parseConnectorIntent(command: string): Promise<AIConnectorIntent> {
  const tenantId = await resolveTenantId()

  // Find the matching intent template
  const match = AI_CONNECTOR_INTENTS.find((t) => t.pattern.test(command))
  if (!match) {
    return {
      matched: false,
      connectorSlug: null,
      connectorName: null,
      action: 'unknown',
      description: 'No matching connector found for this command',
      requiresInstall: false,
      confidence: 0,
    }
  }

  // Check if the connector is installed & connected for this tenant
  const installed = await db.installedIntegration.findFirst({
    where: { tenantId, connectorSlug: match.connectorSlug, status: { in: ['connected', 'syncing'] } },
    select: { id: true, connectorSlug: true, status: true },
  })

  const connector = await db.marketplaceConnector.findUnique({
    where: { slug: match.connectorSlug },
    select: { displayName: true },
  })

  return {
    matched: true,
    connectorSlug: match.connectorSlug,
    connectorName: connector?.displayName ?? match.connectorSlug,
    action: match.action,
    description: match.description,
    requiresInstall: !installed,
    confidence: installed ? 0.95 : 0.7,
  }
}

/** Execute a matched connector intent. Returns the execution result. */
export async function executeConnectorIntent(
  command: string,
): Promise<{ intent: AIConnectorIntent; executed: boolean; result: string; eventId?: string }> {
  const tenantId = await resolveTenantId()
  const intent = await parseConnectorIntent(command)

  if (!intent.matched) {
    return { intent, executed: false, result: 'I could not match that command to any installed connector. Try: "Sync all Shopify orders" or "Send a Slack message".' }
  }

  if (intent.requiresInstall || !intent.connectorSlug) {
    return {
      intent,
      executed: false,
      result: `${intent.connectorName ?? 'That connector'} is not connected yet. Install it from the Integration Marketplace to execute "${intent.description.toLowerCase()}".`,
    }
  }

  // Find the installed integration and execute the action
  const installed = await db.installedIntegration.findFirst({
    where: { tenantId, connectorSlug: intent.connectorSlug, status: { in: ['connected', 'syncing'] } },
    include: { connector: true },
  })
  if (!installed) {
    return { intent, executed: false, result: `${intent.connectorName ?? intent.connectorSlug} is not connected.` }
  }

  // Execute via the sync engine for data-sync actions, or publish an outbound event for action actions
  const { triggerSync } = await import('./sync-engine')
  const { publishEvent } = await import('./event-bus')

  const slug = intent.connectorSlug
  let result = ''
  let eventId: string | undefined

  if (intent.action.startsWith('sync_') || intent.action.includes('sync')) {
    const job = await triggerSync(installed.id, { type: 'manual', direction: 'bidirectional' })
    result = `✅ Executed "${intent.description}" via ${intent.connectorName}. Sync job ${job.status}: ${job.recordsProcessed} records processed (${job.recordsCreated} created, ${job.recordsUpdated} updated) in ${job.durationMs}ms.`
    eventId = job.id
  } else {
    // Action-based intent (send message, create ticket, schedule meeting, etc.)
    eventId = await publishEvent({
      tenantId,
      installedIntegrationId: installed.id,
      connectorSlug: slug,
      eventType: `ai.${intent.action}`,
      source: 'oracle',
      severity: 'info',
      payload: { command, action: intent.action, connector: slug },
    })
    result = `✅ Executed "${intent.description}" via ${intent.connectorName}. Action queued (event ${eventId}).`
  }

  return { intent, executed: true, result, eventId }
}

/** Build a compact context block for Oracle so it knows the connector state. */
export async function buildOracleMarketplaceContext(): Promise<string> {
  const tenantId = await resolveTenantId()

  const [installed, events24h, stats] = await Promise.all([
    db.installedIntegration.findMany({
      where: { tenantId, status: { in: ['connected', 'syncing'] } },
      include: { connector: { select: { displayName: true, category: true, slug: true } } },
      take: 20,
      orderBy: { lastSyncAt: 'desc' },
    }),
    db.integrationEvent.count({ where: { tenantId, publishedAt: { gte: new Date(Date.now() - 86400000) } } }),
    db.integrationEvent.groupBy({
      by: ['eventType'],
      where: { tenantId, publishedAt: { gte: new Date(Date.now() - 86400000) } },
      _count: { _all: true },
      orderBy: { _count: { eventType: 'desc' } },
      take: 5,
    }),
  ])

  if (installed.length === 0) {
    return `MARKETPLACE STATE: No integrations connected yet. Oracle can suggest connectors from the 2,000+ catalog when the user asks about syncing external apps.`
  }

  const lines = installed.map(
    (i) => `  • ${i.connector.displayName} (${i.connector.category}) — ${i.status}, last sync ${i.lastSyncAt ? new Date(i.lastSyncAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : 'never'}`,
  )
  const topEvents = stats.map((s) => `${s.eventType}×${s._count._all}`).join(', ')

  return `MARKETPLACE STATE — Global Integration Marketplace™
${installed.length} connected integration(s):
${lines.join('\n')}
Event Bus (last 24h): ${events24h} events published. Top: ${topEvents || 'none'}
ORACLE MARKETPLACE CAPABILITIES: When the user asks to sync/trigger an external app (e.g. "sync Shopify orders", "send Slack message", "create Jira ticket", "file GST via GSTN"), you may suggest the AI Connector Engine can execute it if the connector is installed. State which connector would handle it.`
}
