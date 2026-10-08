// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — Live Command Observability™
//
// Monitor every command-network target from one screen:
//   organizations, departments, countries, workers, queues, connectors,
//   AI models, executions, compliance, infrastructure, APIs.
// Each signal is derived from REAL production rows + live health checks.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { db, cached, safeFindMany, safeCount, TTL, countBy, minsBetween, clamp100 } from './helpers';
import type { ObservabilitySignal, ObservabilitySummary, ObservabilityTarget, ObservabilityStatus } from './types';

/** Measure live observability signals across all command-network targets. */
export async function measureObservability(): Promise<ObservabilitySignal[]> {
  return cached<ObservabilitySignal[]>('cn:observability:measure', TTL.SHORT, async () => {
    const now = new Date();
    const signals: ObservabilitySignal[] = [];

    // ── Organization health (from GlobalEntity) ───────────────────────────────
    const entityCount = await safeCount(() => db.globalEntity.count({ where: { status: 'active' } }));
    signals.push({
      id: 'obs-org-1', target: 'organization', targetId: 'global', label: 'Global Entity Count',
      status: entityCount > 0 ? 'healthy' : 'warning',
      metricName: 'count', metricValue: entityCount, metricUnit: 'count', threshold: 1,
      message: entityCount > 0 ? `${entityCount} active legal entities consolidated.` : 'No active entities — setup required.',
      observedAt: now.toISOString(),
    });

    // ── Department health (from coordination) ─────────────────────────────────
    const depts = ['crm', 'ai_cfo', 'gst', 'payroll', 'banking', 'ai_hr', 'compliance_cloud'];
    for (const dept of depts) {
      const pendingTasks = await safeCount(() => db.executionTask.count({ where: { status: 'queued' } }));
      signals.push({
        id: `obs-dept-${dept}`, target: 'department', targetId: dept, label: `${dept} queue depth`,
        status: pendingTasks < 10 ? 'healthy' : pendingTasks < 50 ? 'warning' : 'critical',
        metricName: 'queue_depth', metricValue: pendingTasks, metricUnit: 'count', threshold: 50,
        message: `${pendingTasks} queued tasks.`,
        observedAt: now.toISOString(),
      });
    }

    // ── Country health (from GlobalEntity by country) ─────────────────────────
    const countryGroups = await safeFindMany(() => db.globalEntity.groupBy({ by: ['countryIso'], _count: true }));
    for (const c of countryGroups.slice(0, 10)) {
      signals.push({
        id: `obs-country-${c.countryIso}`, target: 'country', targetId: c.countryIso, label: `Country ${c.countryIso}`,
        status: 'healthy',
        metricName: 'entity_count', metricValue: c._count, metricUnit: 'count', threshold: 0,
        message: `${c._count} entities in ${c.countryIso}.`,
        observedAt: now.toISOString(),
      });
    }

    // ── Worker health (from ExecutionTask running) ────────────────────────────
    const runningWorkers = await safeCount(() => db.executionTask.count({ where: { status: 'running' } }));
    signals.push({
      id: 'obs-workers', target: 'worker', targetId: 'pool', label: 'Active Workers',
      status: runningWorkers < 20 ? 'healthy' : 'warning',
      metricName: 'active_count', metricValue: runningWorkers, metricUnit: 'count', threshold: 20,
      message: `${runningWorkers} workers currently executing tasks.`,
      observedAt: now.toISOString(),
    });

    // ── Queue health (from ExecutionTask queued) ──────────────────────────────
    const queueDepth = await safeCount(() => db.executionTask.count({ where: { status: 'queued' } }));
    signals.push({
      id: 'obs-queue', target: 'queue', targetId: 'execution', label: 'Execution Queue',
      status: queueDepth < 50 ? 'healthy' : queueDepth < 200 ? 'warning' : 'critical',
      metricName: 'queue_depth', metricValue: queueDepth, metricUnit: 'count', threshold: 200,
      message: `${queueDepth} tasks waiting in queue.`,
      observedAt: now.toISOString(),
    });

    // ── Connector health (from DataConnection) ────────────────────────────────
    const connectors = await safeFindMany(() => db.dataConnection.findMany({ select: { id: true, label: true, type: true, status: true, lastSyncAt: true, syncInterval: true } }));
    for (const c of connectors.slice(0, 20)) {
      const lagMin = c.lastSyncAt ? minsBetween(new Date(c.lastSyncAt), now) : 9999;
      const status: ObservabilityStatus =
        c.status === 'error' ? 'critical' :
        c.status === 'disconnected' ? 'down' :
        lagMin > 1440 ? 'warning' : 'healthy';
      signals.push({
        id: `obs-conn-${c.id}`, target: 'connector', targetId: c.id, label: c.label,
        status,
        metricName: 'sync_lag', metricValue: Math.min(lagMin, 9999), metricUnit: 'minutes', threshold: 1440,
        message: c.status === 'error' ? 'Connector in error state.' : `Last sync ${lagMin}m ago.`,
        observedAt: now.toISOString(),
      });
    }

    // ── AI model health (from AutonomousSimulation / DevBuild throughput) ─────
    const recentSims = await safeCount(() => db.autonomousSimulation.count({ where: { createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } }));
    signals.push({
      id: 'obs-ai-twin', target: 'ai_model', targetId: 'digital_twin', label: 'Digital Twin Model',
      status: 'healthy',
      metricName: 'throughput', metricValue: recentSims, metricUnit: 'simulations/hr', threshold: 0,
      message: `${recentSims} simulations in last hour.`,
      observedAt: now.toISOString(),
    });

    // ── Execution health (from ExecutionJob) ──────────────────────────────────
    const failedJobs = await safeCount(() => db.executionJob.count({ where: { status: 'failed', createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } }));
    signals.push({
      id: 'obs-execution', target: 'execution', targetId: 'jobs', label: 'Execution Jobs',
      status: failedJobs < 5 ? 'healthy' : failedJobs < 20 ? 'warning' : 'critical',
      metricName: 'error_rate', metricValue: failedJobs, metricUnit: 'count', threshold: 20,
      message: `${failedJobs} failed jobs in last hour.`,
      observedAt: now.toISOString(),
    });

    // ── Compliance health (from ComplianceRisk) ───────────────────────────────
    const openRisks = await safeCount(() => db.complianceRisk.count({ where: { status: { in: ['open', 'investigating'] } } }));
    signals.push({
      id: 'obs-compliance', target: 'compliance', targetId: 'risks', label: 'Compliance Risk Count',
      status: openRisks < 5 ? 'healthy' : openRisks < 15 ? 'warning' : 'critical',
      metricName: 'risk_count', metricValue: openRisks, metricUnit: 'count', threshold: 15,
      message: `${openRisks} open compliance risks.`,
      observedAt: now.toISOString(),
    });

    // ── Infrastructure health (from DB connection) ────────────────────────────
    let dbHealthy = true;
    try {
      await db.$queryRaw`SELECT 1`;
    } catch {
      dbHealthy = false;
    }
    signals.push({
      id: 'obs-infra-db', target: 'infrastructure', targetId: 'database', label: 'Database',
      status: dbHealthy ? 'healthy' : 'down',
      metricName: 'uptime', metricValue: dbHealthy ? 100 : 0, metricUnit: '%', threshold: 99,
      message: dbHealthy ? 'Database responsive.' : 'Database unreachable!',
      observedAt: now.toISOString(),
    });

    // ── API health (from recent API audit logs) ───────────────────────────────
    const recentAudit = await safeCount(() => db.commandAuditLog.count({ where: { occurredAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } }));
    signals.push({
      id: 'obs-api', target: 'api', targetId: 'command', label: 'Command API',
      status: 'healthy',
      metricName: 'throughput', metricValue: recentAudit, metricUnit: 'requests/hr', threshold: 0,
      message: `${recentAudit} commands processed in last hour.`,
      observedAt: now.toISOString(),
    });

    return signals;
  });
}

/** Get the latest observability signals. */
export async function getObservabilitySignals(): Promise<ObservabilitySignal[]> {
  return cached<ObservabilitySignal[]>('cn:observability:signals', TTL.SHORT, async () => {
    return measureObservability();
  });
}

/** Observability summary — aggregated from real signals. */
export async function getObservabilitySummary(): Promise<ObservabilitySummary> {
  return cached<ObservabilitySummary>('cn:observability:summary', TTL.SHORT, async () => {
    const signals = await measureObservability();
    const byStatus = countBy(signals, (s) => s.status);
    const byTarget = countBy(signals, (s) => s.target);
    const healthMap: Record<ObservabilityStatus, number> = { healthy: 1.0, warning: 0.5, critical: 0.2, down: 0 };
    const healthScore = signals.length > 0
      ? clamp100(Math.round((signals.reduce((s, sig) => s + (healthMap[sig.status] ?? 0), 0) / signals.length) * 100))
      : 100;
    return {
      totalSignals: signals.length,
      byStatus,
      byTarget,
      healthScore,
      criticalCount: byStatus.critical ?? 0,
      warningCount: byStatus.warning ?? 0,
    };
  });
}
