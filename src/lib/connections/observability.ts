// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — PHASE 2B · MODULE 6 — Observability Dashboard™
//
// Computes system-health metrics for the System Health™ screen:
//   • GSTN Status / Bank Status (up / degraded / down)
//   • API Latency (time to load live data)
//   • Sync Queue depth
//   • Error Logs (recent sync errors + validation errors)
//   • Records Imported (total)
//   • Data Quality Score
//   • Success Rate
//   • GSTN Uptime / Bank Uptime (success % over last 24h)
//   • Average Sync Time (ms)
//   • Failure Rate
//
// Never throws — returns a degraded payload on any error.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getValidationSummary } from './validation';
import { getAutoSyncStatus, getSyncQueue } from './auto-sync';
import { getAlertSummary } from './alerts';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ServiceStatus = 'up' | 'degraded' | 'down' | 'disconnected';

export interface ServiceHealth {
  name: string;
  type: 'gstn' | 'bank';
  status: ServiceStatus;
  uptimePct: number; // success rate over last 24h
  lastSync?: string;
  lastSyncDurationMs: number;
  consecutiveFailures: number;
  recordsImported: number;
  lastError?: string;
  syncStatus: string;
  connectionId?: string;
}

export interface ErrorLogEntry {
  id: string;
  source: 'sync' | 'validation' | 'system';
  severity: 'error' | 'warning';
  message: string;
  detail?: string;
  connectionLabel?: string;
  timestamp: string;
}

export interface SystemHealthPayload {
  computedAt: string;
  services: ServiceHealth[];
  metrics: {
    gstnUptime: number;
    bankUptime: number;
    averageSyncTimeMs: number;
    failureRate: number;
    successRate: number;
    totalSyncs24h: number;
    totalRecordsImported: number;
    dataQualityScore: number;
    apiLatencyMs: number;
  };
  queue: {
    depth: number;
    running: number;
    recent: Array<{
      id: string;
      connectionLabel: string;
      status: string;
      trigger: string;
      attempts: number;
      scheduledAt: string;
    }>;
  };
  errorLogs: ErrorLogEntry[];
  alertSummary: {
    total: number;
    open: number;
    critical: number;
    warning: number;
  };
  autoSyncStatus: {
    totalConnections: number;
    autoSyncEnabled: number;
    dueNow: number;
    queueDepth: number;
    running: number;
    nextRunAt?: string;
    lastRunAt?: string;
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function deriveStatus(
  syncStatus: string,
  consecutiveFailures: number,
  uptimePct: number,
): ServiceStatus {
  if (syncStatus === 'disconnected') return 'disconnected';
  if (consecutiveFailures >= 3 || uptimePct < 50) return 'down';
  if (consecutiveFailures >= 1 || uptimePct < 85 || syncStatus === 'partial' || syncStatus === 'failed') {
    return 'degraded';
  }
  return 'up';
}

async function computeUptime(connectionId: string): Promise<{ uptimePct: number; totalSyncs: number }> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h
    const logs = await db.syncLog.findMany({
      where: { connectionId, startedAt: { gte: since } },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
    if (logs.length === 0) return { uptimePct: 100, totalSyncs: 0 };
    const successCount = logs.filter((l) => l.status === 'success' || l.status === 'partial').length;
    return {
      uptimePct: Math.round((successCount / logs.length) * 100),
      totalSyncs: logs.length,
    };
  } catch {
    return { uptimePct: 100, totalSyncs: 0 };
  }
}

// ─── Public: compute full system health ────────────────────────────────────────

export async function getSystemHealth(): Promise<SystemHealthPayload> {
  const t0 = Date.now();

  try {
    // ── Services ──
    const connections = await db.businessConnection.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'asc' },
    });

    const services: ServiceHealth[] = [];
    let totalSyncTimeMs = 0;
    let totalSyncCount = 0;
    let totalRecords = 0;
    let gstnUptime = 100;
    let bankUptime = 100;

    for (const conn of connections) {
      const { uptimePct, totalSyncs } = await computeUptime(conn.id);
      const status = deriveStatus(conn.syncStatus, conn.consecutiveFailures, uptimePct);

      // Get the last sync log for duration + error
      const lastLog = await db.syncLog.findFirst({
        where: { connectionId: conn.id },
        orderBy: { startedAt: 'desc' },
      });

      const durationMs = lastLog?.startedAt && lastLog?.completedAt
        ? lastLog.completedAt.getTime() - lastLog.startedAt.getTime()
        : conn.lastSyncDurationMs;

      totalSyncTimeMs += durationMs;
      totalSyncCount += 1;
      totalRecords += conn.lastSyncRecords;

      if (conn.type === 'gstn') gstnUptime = uptimePct;
      if (conn.type === 'bank') bankUptime = uptimePct;

      services.push({
        name: conn.tradeName ?? conn.legalName ?? conn.provider,
        type: conn.type as 'gstn' | 'bank',
        status,
        uptimePct,
        lastSync: conn.lastSyncedAt?.toISOString(),
        lastSyncDurationMs: durationMs,
        consecutiveFailures: conn.consecutiveFailures,
        recordsImported: conn.lastSyncRecords,
        lastError: conn.syncStatus === 'failed' || conn.syncStatus === 'partial' ? conn.lastSyncMessage : undefined,
        syncStatus: conn.syncStatus,
        connectionId: conn.id,
      });
    }

    // ── Sync metrics (last 24h) ──
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentLogs = await db.syncLog.findMany({
      where: { startedAt: { gte: since } },
      orderBy: { startedAt: 'desc' },
      take: 500,
    });
    const totalSyncs24h = recentLogs.length;
    const successCount = recentLogs.filter((l) => l.status === 'success').length;
    const failedCount = recentLogs.filter((l) => l.status === 'failed').length;
    const successRate = totalSyncs24h > 0 ? Math.round((successCount / totalSyncs24h) * 100) : 100;
    const failureRate = totalSyncs24h > 0 ? Math.round((failedCount / totalSyncs24h) * 100) : 0;

    // Average sync time
    const syncsWithDuration = recentLogs.filter((l) => l.startedAt && l.completedAt);
    const averageSyncTimeMs = syncsWithDuration.length > 0
      ? Math.round(
          syncsWithDuration.reduce((s, l) => s + (l.completedAt!.getTime() - l.startedAt.getTime()), 0) /
            syncsWithDuration.length,
        )
      : 0;

    // ── Validation ──
    const validation = await getValidationSummary();

    // ── Queue ──
    const queueItems = await getSyncQueue(20);
    const [autoSyncStatus, alertSummary] = await Promise.all([
      getAutoSyncStatus(),
      getAlertSummary(),
    ]);

    // ── Error logs ──
    const errorLogs: ErrorLogEntry[] = [];

    // Sync errors
    const syncErrors = recentLogs
      .filter((l) => l.status === 'failed' || l.status === 'partial')
      .slice(0, 15);
    for (const log of syncErrors) {
      const conn = connections.find((c) => c.id === log.connectionId);
      errorLogs.push({
        id: log.id,
        source: 'sync',
        severity: log.status === 'failed' ? 'error' : 'warning',
        message: log.message ?? `Sync ${log.status}`,
        detail: log.errorDetail ?? undefined,
        connectionLabel: conn?.tradeName ?? conn?.provider ?? 'Unknown',
        timestamp: log.startedAt.toISOString(),
      });
    }

    // Validation errors
    for (const issue of validation.recentIssues.filter((i) => i.severity === 'error').slice(0, 10)) {
      errorLogs.push({
        id: `val-${issue.entityType}-${issue.ruleId}-${Date.now()}`,
        source: 'validation',
        severity: 'error',
        message: issue.message,
        detail: issue.payload ? JSON.stringify(issue.payload) : undefined,
        timestamp: new Date().toISOString(),
      });
    }

    // Sort error logs by timestamp desc
    errorLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const apiLatencyMs = Date.now() - t0;

    return {
      computedAt: new Date().toISOString(),
      services,
      metrics: {
        gstnUptime,
        bankUptime,
        averageSyncTimeMs,
        failureRate,
        successRate,
        totalSyncs24h,
        totalRecordsImported: totalRecords,
        dataQualityScore: validation.dataQualityScore,
        apiLatencyMs,
      },
      queue: {
        depth: autoSyncStatus.queueDepth,
        running: autoSyncStatus.running,
        recent: queueItems.slice(0, 10).map((q) => ({
          id: q.id,
          connectionLabel: q.connectionLabel,
          status: q.status,
          trigger: q.trigger,
          attempts: q.attempts,
          scheduledAt: q.scheduledAt,
        })),
      },
      errorLogs: errorLogs.slice(0, 25),
      alertSummary: {
        total: alertSummary.total,
        open: alertSummary.open,
        critical: alertSummary.critical,
        warning: alertSummary.warning,
      },
      autoSyncStatus: {
        totalConnections: autoSyncStatus.totalConnections,
        autoSyncEnabled: autoSyncStatus.autoSyncEnabled,
        dueNow: autoSyncStatus.dueNow,
        queueDepth: autoSyncStatus.queueDepth,
        running: autoSyncStatus.running,
        nextRunAt: autoSyncStatus.nextRunAt,
        lastRunAt: autoSyncStatus.lastRunAt,
      },
    };
  } catch (err) {
    console.error('getSystemHealth error:', err);
    return {
      computedAt: new Date().toISOString(),
      services: [],
      metrics: {
        gstnUptime: 0,
        bankUptime: 0,
        averageSyncTimeMs: 0,
        failureRate: 0,
        successRate: 0,
        totalSyncs24h: 0,
        totalRecordsImported: 0,
        dataQualityScore: 0,
        apiLatencyMs: Date.now() - t0,
      },
      queue: { depth: 0, running: 0, recent: [] },
      errorLogs: [],
      alertSummary: { total: 0, open: 0, critical: 0, warning: 0 },
      autoSyncStatus: {
        totalConnections: 0,
        autoSyncEnabled: 0,
        dueNow: 0,
        queueDepth: 0,
        running: 0,
      },
    };
  }
}
