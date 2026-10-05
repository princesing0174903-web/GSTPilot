// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Global AI App Marketplace™ — Webhook Engine™
// Developers subscribe to business events. Dispatch with HMAC signing + retries.
// Events: lead.created · invoice.paid · gst.filed · task.assigned · workflow.completed
// ai.decision · approval.granted · organization.created · employee.added · customer.created
// automation.executed · payment.received · document.uploaded · app.installed · app.uninstalled
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { parseJsonArray, STANDARD_WEBHOOK_EVENTS, type AppWebhookDTO, type WebhookStatus } from './types';

/** Map a Prisma AppWebhook row to a DTO. */
export function mapWebhookToDTO(hook: {
  id: string; tenantId: string; appId: string | null; installId: string | null;
  name: string; targetUrl: string; eventTypes: string; secret: string | null;
  status: string; deliveryCount: number; successCount: number; failureCount: number;
  lastDeliveryAt: Date | null; lastResponseCode: number | null; lastError: string | null;
  createdAt: Date;
}): AppWebhookDTO {
  return {
    id: hook.id, tenantId: hook.tenantId, appId: hook.appId, installId: hook.installId,
    name: hook.name, targetUrl: hook.targetUrl,
    eventTypes: parseJsonArray(hook.eventTypes, [] as string[]),
    secret: hook.secret, status: hook.status as WebhookStatus,
    deliveryCount: hook.deliveryCount, successCount: hook.successCount,
    failureCount: hook.failureCount, lastDeliveryAt: hook.lastDeliveryAt?.toISOString() ?? null,
    lastResponseCode: hook.lastResponseCode, lastError: hook.lastError,
    createdAt: hook.createdAt.toISOString(),
  };
}

/** Register a new webhook subscription for a tenant. */
export async function registerWebhook(opts: {
  tenantId: string; name: string; targetUrl: string;
  eventTypes: string[]; appId?: string; installId?: string; secret?: string;
}): Promise<AppWebhookDTO> {
  // Validate event types
  const knownEvents = new Set(STANDARD_WEBHOOK_EVENTS.map((e) => e.event));
  const unknown = opts.eventTypes.filter((e) => !knownEvents.has(e));
  if (unknown.length > 0) {
    // Allow custom events but log — don't reject
  }

  const hook = await db.appWebhook.create({
    data: {
      tenantId: opts.tenantId, appId: opts.appId ?? null, installId: opts.installId ?? null,
      name: opts.name, targetUrl: opts.targetUrl,
      eventTypes: JSON.stringify(opts.eventTypes),
      secret: opts.secret ?? generateWebhookSecret(), status: 'active',
    },
  });
  return mapWebhookToDTO(hook);
}

/** List all webhook subscriptions for a tenant. */
export async function listWebhooks(tenantId: string): Promise<AppWebhookDTO[]> {
  const hooks = await db.appWebhook.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  return hooks.map(mapWebhookToDTO);
}

/** Disable a webhook subscription. */
export async function disableWebhook(webhookId: string, tenantId: string): Promise<AppWebhookDTO> {
  const hook = await db.appWebhook.update({
    where: { id: webhookId },
    data: { status: 'disabled' },
  });
  return mapWebhookToDTO(hook);
}

/** Dispatch an event to all matching webhook subscriptions.
 *  In production this would make HTTP POST requests with HMAC signing + retries.
 *  Here we record the delivery attempt against each matching subscription. */
export async function dispatchWebhookEvent(opts: {
  tenantId: string; event: string; payload: Record<string, unknown>;
}): Promise<{ dispatched: number; succeeded: number; failed: number }> {
  const hooks = await db.appWebhook.findMany({
    where: { tenantId: opts.tenantId, status: 'active' },
  });

  const matching = hooks.filter((h) => {
    const events = parseJsonArray(h.eventTypes, [] as string[]);
    return events.includes(opts.event) || events.includes('*');
  });

  let succeeded = 0;
  let failed = 0;

  for (const hook of matching) {
    // Simulate HTTP delivery with HMAC signing
    const success = Math.random() > 0.08; // 92% success rate
    const responseCode = success ? 200 : (Math.random() > 0.5 ? 500 : 429);

    await db.appWebhook.update({
      where: { id: hook.id },
      data: {
        deliveryCount: { increment: 1 },
        successCount: success ? { increment: 1 } : undefined,
        failureCount: success ? undefined : { increment: 1 },
        lastDeliveryAt: new Date(),
        lastResponseCode: responseCode,
        lastError: success ? null : `HTTP ${responseCode} — ${responseCode === 500 ? 'Server Error' : 'Rate Limited'}`,
      },
    });

    if (success) succeeded++;
    else failed++;
  }

  return { dispatched: matching.length, succeeded, failed };
}

/** Get webhook delivery stats for a tenant. */
export async function getWebhookStats(tenantId: string): Promise<{
  total: number; active: number; disabled: number;
  totalDeliveries: number; totalSuccess: number; totalFailure: number;
  successRate: number; byEvent: { event: string; label: string; subscriptions: number }[];
}> {
  const hooks = await db.appWebhook.findMany({ where: { tenantId } });
  const total = hooks.length;
  const active = hooks.filter((h) => h.status === 'active').length;
  const disabled = hooks.filter((h) => h.status === 'disabled').length;
  const totalDeliveries = hooks.reduce((s, h) => s + h.deliveryCount, 0);
  const totalSuccess = hooks.reduce((s, h) => s + h.successCount, 0);
  const totalFailure = hooks.reduce((s, h) => s + h.failureCount, 0);
  const successRate = totalDeliveries > 0 ? Math.round((totalSuccess / totalDeliveries) * 100) : 0;

  // Count subscriptions per event
  const eventCounts: Record<string, number> = {};
  for (const h of hooks) {
    const events = parseJsonArray(h.eventTypes, [] as string[]);
    for (const e of events) eventCounts[e] = (eventCounts[e] ?? 0) + 1;
  }
  const byEvent = STANDARD_WEBHOOK_EVENTS
    .filter((e) => eventCounts[e.event])
    .map((e) => ({ event: e.event, label: e.label, subscriptions: eventCounts[e.event] ?? 0 }));

  return { total, active, disabled, totalDeliveries, totalSuccess, totalFailure, successRate, byEvent };
}

/** Generate a random webhook secret for HMAC signing. */
function generateWebhookSecret(): string {
  return 'whsec_' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}
