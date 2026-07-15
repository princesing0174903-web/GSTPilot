// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Global Integration Marketplace™ — Seed
// Bootstraps realistic installed integrations, events, sync jobs & analytics
// for the default tenant so the Marketplace shows LIVE data on first load.
// Idempotent — safe to call on every boot.
//
// GATING: Disabled by default. Set `GSTPILOT_ALLOW_SEED=true` in env (and
// `NODE_ENV !== 'production'`) to enable. Real marketplace installs should
// happen via the user-facing connect/disconnect flow — this seed file
// previously persisted 12 fake installed integrations (Gmail, Shopify,
// Razorpay, Stripe, Slack, QuickBooks, HubSpot, GitHub, ICICI, HDFC, WhatsApp,
// GSTN) with fake last-sync timestamps. All synthetic. Now no-ops unless
// explicitly enabled.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import { resolveTenantId } from '@/lib/enterprise/tenant'
import { ensureCatalogSeeded } from './registry'
import { publishEvent } from './event-bus'
import { triggerSync } from './sync-engine'

let _seeded = false

export async function seedMarketplace(): Promise<void> {
  // GATING: Real marketplace installs come from the user-facing connect flow.
  // Set GSTPILOT_ALLOW_SEED=true (and NODE_ENV !== 'production') to re-enable.
  if (process.env.GSTPILOT_ALLOW_SEED !== 'true') return
  if (process.env.NODE_ENV === 'production') return
  if (_seeded) return
  _seeded = true
  try {
    await ensureCatalogSeeded()
    const tenantId = await resolveTenantId()

    // 1. Install & connect priority connectors if none installed yet
    const existingCount = await db.installedIntegration.count({ where: { tenantId } })
    if (existingCount === 0) {
      const prioritySlugs = [
        { slug: 'gstn', account: '29ABCDE1234F1Z5', scopes: ['gstn.read', 'gstn.file'] },
        { slug: 'gmail', account: 'prince@gstpilot.dev', scopes: ['gmail.readonly', 'gmail.send'] },
        { slug: 'shopify', account: 'gstpilot.myshopify.com', scopes: ['read_orders', 'read_products', 'read_customers'] },
        { slug: 'razorpay', account: 'acc_29ABCDE', scopes: ['payments', 'invoices'] },
        { slug: 'stripe', account: 'acct_1Qxyz...gstpilot', scopes: ['charges', 'customers', 'invoices'] },
        { slug: 'slack', account: 'GSTPilot Workspace', scopes: ['channels:read', 'chat:write'] },
        { slug: 'quickbooks', account: 'GSTPilot Pvt Ltd', scopes: ['com.intuit.quickbooks.accounting'] },
        { slug: 'hubspot', account: 'GSTPilot', scopes: ['contacts', 'companies', 'deals'] },
        { slug: 'github', account: 'gstpilot', scopes: ['repo', 'issues'] },
        { slug: 'icici-bank', account: 'ICIC0001234', scopes: ['bank.read'] },
        { slug: 'hdfc-bank', account: 'HDFC0005678', scopes: ['bank.read'] },
        { slug: 'whatsapp-business', account: '+91 98765 43210', scopes: ['whatsapp_business_messaging'] },
      ]

      for (const p of prioritySlugs) {
        const connector = await db.marketplaceConnector.findUnique({ where: { slug: p.slug } })
        if (!connector) continue
        const installed = await db.installedIntegration.create({
          data: {
            tenantId,
            connectorId: connector.id,
            connectorSlug: p.slug,
            displayName: connector.displayName,
            status: 'connected',
            health: 'healthy',
            authType: connector.authType,
            connectedAccountId: p.account,
            scopes: JSON.stringify(p.scopes),
            config: JSON.stringify({ autoSync: true, conflictResolution: 'latest_wins' }),
            lastSyncAt: new Date(Date.now() - Math.floor(Math.random() * 3600000)),
            syncFrequency: '15m',
          },
        })
        // Seed an initial log
        await db.connectorLog.create({
          data: {
            installedIntegrationId: installed.id,
            level: 'info',
            message: `Connected as ${p.account}`,
            code: 'AUTH_SUCCESS',
          },
        })
      }
    }

    // 2. Seed recent events if none exist
    const eventCount = await db.integrationEvent.count({ where: { tenantId } })
    if (eventCount === 0) {
      const eventTemplates: { connectorSlug: string; eventType: string; severity: 'info' | 'warning' | 'critical' }[] = [
        { connectorSlug: 'shopify', eventType: 'order.placed', severity: 'info' },
        { connectorSlug: 'stripe', eventType: 'invoice.paid', severity: 'info' },
        { connectorSlug: 'razorpay', eventType: 'payment.received', severity: 'info' },
        { connectorSlug: 'razorpay', eventType: 'payment.failed', severity: 'warning' },
        { connectorSlug: 'gstn', eventType: 'gst.filed', severity: 'info' },
        { connectorSlug: 'gmail', eventType: 'lead.created', severity: 'info' },
        { connectorSlug: 'hubspot', eventType: 'deal.won', severity: 'info' },
        { connectorSlug: 'hubspot', eventType: 'deal.lost', severity: 'warning' },
        { connectorSlug: 'slack', eventType: 'ticket.created', severity: 'info' },
        { connectorSlug: 'quickbooks', eventType: 'expense.approved', severity: 'info' },
        { connectorSlug: 'quickbooks', eventType: 'invoice.created', severity: 'info' },
        { connectorSlug: 'hdfc-bank', eventType: 'payment.received', severity: 'info' },
        { connectorSlug: 'whatsapp-business', eventType: 'ticket.resolved', severity: 'info' },
        { connectorSlug: 'github', eventType: 'task.completed', severity: 'info' },
      ]
      // Publish ~40 events spread across the last 24h
      for (let i = 0; i < 40; i++) {
        const tmpl = eventTemplates[i % eventTemplates.length]
        await publishEvent({
          tenantId,
          connectorSlug: tmpl.connectorSlug,
          eventType: tmpl.eventType,
          source: tmpl.connectorSlug,
          severity: tmpl.severity,
          payload: { seed: true, index: i, amount: Math.floor(1000 + Math.random() * 50000) },
        })
      }
      // Mark a portion as consumed
      const recent = await db.integrationEvent.findMany({ take: 25, orderBy: { publishedAt: 'desc' } })
      const consumers = ['ai-ceo', 'ai-workforce', 'oracle', 'automation']
      for (let i = 0; i < recent.length; i++) {
        if (i % 3 === 0) {
          await db.integrationEvent.update({
            where: { id: recent[i].id },
            data: { consumed: true, consumedBy: consumers[i % consumers.length] },
          })
        }
      }
    }

    // 3. Seed analytics if none exist (last 14 days)
    const analyticsCount = await db.connectorAnalytic.count({ where: { tenantId } })
    if (analyticsCount === 0) {
      const installed = await db.installedIntegration.findMany({ where: { tenantId, status: 'connected' } })
      for (let d = 13; d >= 0; d--) {
        const bucket = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10)
        for (const inst of installed) {
          const apiCalls = Math.floor(50 + Math.random() * 800)
          const syncSuccess = Math.floor(5 + Math.random() * 20)
          const syncFailed = Math.floor(Math.random() * 3)
          const recordsSynced = Math.floor(100 + Math.random() * 2000)
          await db.connectorAnalytic.create({
            data: {
              tenantId,
              installedIntegrationId: inst.id,
              bucket,
              apiCalls,
              syncSuccess,
              syncFailed,
              eventsPublished: Math.floor(5 + Math.random() * 40),
              recordsSynced,
              avgLatencyMs: Math.floor(50 + Math.random() * 300),
              errorsCount: syncFailed * Math.floor(1 + Math.random() * 5),
              automationTriggered: Math.floor(Math.random() * 10),
              aiUsageCount: Math.floor(Math.random() * 30),
              revenueImpact: Math.floor(500 + Math.random() * 15000),
              healthScore: Math.round(85 + Math.random() * 15),
            },
          })
        }
      }
    }

    // 4. Seed a few historical sync jobs if none exist
    const syncCount = await db.syncJob.count({ where: { installedIntegration: { tenantId } } })
    if (syncCount === 0) {
      const installed = await db.installedIntegration.findMany({ where: { tenantId, status: 'connected' }, take: 6 })
      for (const inst of installed) {
        for (let j = 0; j < 3; j++) {
          const startedAt = new Date(Date.now() - j * 3600000 - Math.floor(Math.random() * 1800000))
          const durationMs = Math.floor(800 + Math.random() * 4200)
          const success = Math.random() > 0.15
          const recordCount = Math.floor(50 + Math.random() * 500)
          const failed = success ? Math.floor(recordCount * 0.02) : Math.floor(recordCount * 0.4)
          await db.syncJob.create({
            data: {
              installedIntegrationId: inst.id,
              type: j === 0 ? 'manual' : 'scheduled',
              status: success ? 'success' : 'failed',
              direction: 'bidirectional',
              recordsProcessed: recordCount,
              recordsCreated: Math.floor(recordCount * 0.3),
              recordsUpdated: recordCount - failed - Math.floor(recordCount * 0.3),
              recordsFailed: failed,
              conflictCount: Math.floor(Math.random() * 4),
              retryCount: Math.floor(Math.random() * 2),
              startedAt,
              completedAt: new Date(startedAt.getTime() + durationMs),
              durationMs,
              error: success ? null : `${failed} records failed`,
            },
          })
        }
      }
    }
  } catch (err) {
    console.error('[marketplace/seed] error:', err)
  }
}
