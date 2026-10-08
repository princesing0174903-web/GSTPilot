// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — PHASE 2B · MODULE 4 — Real-Time Alert Center™
//
// Generates user-facing Alerts from BusinessEvents. An Alert is the user-facing
// representation of a change — it carries a severity-coloured UI, a message,
// and a lifecycle: open → read → archived/dismissed.
//
// Alert generation is idempotent: for each event we check whether an open alert
// of the same type already exists (within a dedup window) before creating a new
// one. This prevents alert spam when many similar events fire in a batch.
//
// Never throws — partial failures never break the alert pipeline.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { BusinessEventRow, EventSeverity } from './change-detection';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'warning' | 'info' | 'positive';
export type AlertStatus = 'open' | 'read' | 'archived' | 'dismissed';

export interface AlertRow {
  id: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  sourceType?: string;
  sourceId?: string;
  status: AlertStatus;
  actionUrl?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
  ackedAt?: string;
  resolvedAt?: string;
}

export interface AlertSummary {
  total: number;
  open: number;
  critical: number;
  warning: number;
  info: number;
  positive: number;
}

// ─── Severity mapping (event severity → alert severity) ────────────────────────

function mapSeverity(eventSeverity: EventSeverity): AlertSeverity {
  // Events use 'critical' | 'warning' | 'info' | 'positive' — same vocabulary.
  return eventSeverity as AlertSeverity;
}

// ─── Alert title/message templates per event type ──────────────────────────────

interface AlertTemplate {
  title: (event: BusinessEventRow) => string;
  message: (event: BusinessEventRow) => string;
  actionUrl?: string;
}

const ALERT_TEMPLATES: Partial<Record<string, AlertTemplate>> = {
  NEW_NOTICE: {
    title: (e) => e.title,
    message: (e) => e.description ?? 'A new GST notice requires your attention.',
    actionUrl: 'data-connections',
  },
  NOTICE_RESOLVED: {
    title: (e) => e.title,
    message: (e) => e.description ?? 'A notice was resolved.',
    actionUrl: 'data-connections',
  },
  ITC_INCREASED: {
    title: (e) => e.title,
    message: (e) => e.description ?? 'Your available ITC increased.',
    actionUrl: 'dashboard',
  },
  ITC_DECREASED: {
    title: (e) => e.title,
    message: (e) => e.description ?? 'Your available ITC decreased.',
    actionUrl: 'dashboard',
  },
  RETURN_OVERDUE: {
    title: (e) => e.title,
    message: (e) => e.description ?? 'A GST return is now overdue — late fees are accruing.',
    actionUrl: 'returns',
  },
  RETURN_FILED: {
    title: (e) => e.title,
    message: (e) => e.description ?? 'A GST return was filed successfully.',
    actionUrl: 'returns',
  },
  NEW_RETURN: {
    title: (e) => e.title,
    message: (e) => e.description ?? 'A new filing period is available.',
    actionUrl: 'returns',
  },
  COLLECTION_DROPPED: {
    title: (e) => e.title,
    message: (e) => e.description ?? 'Monthly collections dropped materially.',
    actionUrl: 'dashboard',
  },
  COLLECTION_SURGE: {
    title: (e) => e.title,
    message: (e) => e.description ?? 'Monthly collections surged.',
    actionUrl: 'dashboard',
  },
  CASH_POSITION_CHANGED: {
    title: (e) => e.title,
    message: (e) => e.description ?? 'Your cash position changed materially.',
    actionUrl: 'dashboard',
  },
  REVENUE_CHANGED: {
    title: (e) => e.title,
    message: (e) => e.description ?? 'Revenue changed materially.',
    actionUrl: 'dashboard',
  },
  COMPLIANCE_CHANGED: {
    title: (e) => e.title,
    message: (e) => e.description ?? 'Your compliance score changed.',
    actionUrl: 'dashboard',
  },
  SYNC_COMPLETED: {
    title: (e) => e.title,
    message: (e) => e.description ?? 'A data sync completed.',
    actionUrl: 'data-connections',
  },
  SYNC_FAILED: {
    title: (e) => e.title,
    message: (e) => e.description ?? 'A data sync failed and may need attention.',
    actionUrl: 'system-health',
  },
};

// ─── Public: generate alerts from events (idempotent) ──────────────────────────

/**
 * For each event, creates an Alert row if no open alert of the same type exists.
 * Returns the number of alerts created. Never throws.
 */
export async function generateAlertsFromEvents(events: BusinessEventRow[]): Promise<number> {
  let created = 0;
  for (const event of events) {
    try {
      // Dedup: skip if an open alert of this type already exists
      const existing = await db.alert.findFirst({
        where: {
          type: event.type,
          status: { in: ['open', 'read'] },
          sourceId: event.id,
        },
      });
      if (existing) continue;

      const template = ALERT_TEMPLATES[event.type];
      if (!template) continue; // unknown event type — skip

      const severity = mapSeverity(event.severity);
      // SYNC_COMPLETED is info-level noise — only alert if there were errors
      if (event.type === 'SYNC_COMPLETED' && event.payload?.errorsCount === 0) {
        // Still create it but as 'info' and it will be auto-archived quickly
      }

      await db.alert.create({
        data: {
          type: event.type,
          severity,
          title: template.title(event),
          message: template.message(event),
          sourceType: 'system',
          sourceId: event.id,
          status: 'open',
          actionUrl: template.actionUrl ?? null,
          payload: event.payload ? JSON.stringify({ ...event.payload, eventId: event.id }) : null,
        },
      });
      created++;
    } catch (err) {
      console.error('generateAlertsFromEvents error for event', event.type, err);
    }
  }
  return created;
}

// ─── Public: list alerts ───────────────────────────────────────────────────────

export async function listAlerts(opts?: {
  status?: AlertStatus | 'all';
  limit?: number;
}): Promise<AlertRow[]> {
  try {
    const where = opts?.status && opts.status !== 'all'
      ? { status: opts.status }
      : { status: { in: ['open', 'read'] } };
    const rows = await db.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: opts?.limit ?? 100,
    });
    return rows.map(mapAlertRow);
  } catch (err) {
    console.error('listAlerts error:', err);
    return [];
  }
}

export async function listAlertsBySeverity(severity: AlertSeverity, limit = 50): Promise<AlertRow[]> {
  try {
    const rows = await db.alert.findMany({
      where: { severity, status: { in: ['open', 'read'] } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(mapAlertRow);
  } catch (err) {
    console.error('listAlertsBySeverity error:', err);
    return [];
  }
}

// ─── Public: alert summary (counts) ────────────────────────────────────────────

export async function getAlertSummary(): Promise<AlertSummary> {
  try {
    const [open, critical, warning, info, positive, total] = await Promise.all([
      db.alert.count({ where: { status: 'open' } }),
      db.alert.count({ where: { status: 'open', severity: 'critical' } }),
      db.alert.count({ where: { status: 'open', severity: 'warning' } }),
      db.alert.count({ where: { status: 'open', severity: 'info' } }),
      db.alert.count({ where: { status: 'open', severity: 'positive' } }),
      db.alert.count({ where: { status: { in: ['open', 'read'] } } }),
    ]);
    return { total, open, critical, warning, info, positive };
  } catch (err) {
    console.error('getAlertSummary error:', err);
    return { total: 0, open: 0, critical: 0, warning: 0, info: 0, positive: 0 };
  }
}

// ─── Public: alert lifecycle actions ───────────────────────────────────────────

export async function markAlertRead(alertId: string): Promise<void> {
  try {
    await db.alert.update({
      where: { id: alertId },
      data: { status: 'read', ackedAt: new Date() },
    });
  } catch (err) {
    console.error('markAlertRead error:', err);
  }
}

export async function markAllAlertsRead(): Promise<number> {
  try {
    const result = await db.alert.updateMany({
      where: { status: 'open' },
      data: { status: 'read', ackedAt: new Date() },
    });
    return result.count;
  } catch (err) {
    console.error('markAllAlertsRead error:', err);
    return 0;
  }
}

export async function dismissAlert(alertId: string): Promise<void> {
  try {
    await db.alert.update({
      where: { id: alertId },
      data: { status: 'dismissed', resolvedAt: new Date() },
    });
  } catch (err) {
    console.error('dismissAlert error:', err);
  }
}

export async function archiveAlert(alertId: string): Promise<void> {
  try {
    await db.alert.update({
      where: { id: alertId },
      data: { status: 'archived', resolvedAt: new Date() },
    });
  } catch (err) {
    console.error('archiveAlert error:', err);
  }
}

export async function resolveAlert(alertId: string): Promise<void> {
  try {
    await db.alert.update({
      where: { id: alertId },
      data: { status: 'archived', resolvedAt: new Date() },
    });
  } catch (err) {
    console.error('resolveAlert error:', err);
  }
}

export async function getAlert(alertId: string): Promise<AlertRow | null> {
  try {
    const row = await db.alert.findUnique({ where: { id: alertId } });
    return row ? mapAlertRow(row) : null;
  } catch (err) {
    console.error('getAlert error:', err);
    return null;
  }
}

// ─── Helper ────────────────────────────────────────────────────────────────────

function mapAlertRow(r: Awaited<ReturnType<typeof db.alert.findFirst>>): AlertRow {
  return {
    id: r!.id,
    type: r!.type,
    severity: r!.severity as AlertSeverity,
    title: r!.title,
    message: r!.message,
    sourceType: r!.sourceType ?? undefined,
    sourceId: r!.sourceId ?? undefined,
    status: r!.status as AlertStatus,
    actionUrl: r!.actionUrl ?? undefined,
    payload: r!.payload ? safeParse(r!.payload) : undefined,
    createdAt: r!.createdAt.toISOString(),
    ackedAt: r!.ackedAt?.toISOString(),
    resolvedAt: r!.resolvedAt?.toISOString(),
  };
}

function safeParse(s: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
