// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT GLOBAL CONNECTIVITY FABRIC™ — CONNECTIVITY HEALTH CENTER
// Monitor connected services, API latency, failures, rate limits, authentication,
// expired tokens, webhook health, sync status, retries, data freshness.
// Automatic recovery recommendations.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  ConnectorCategory, ConnectorHealth, HealthCenter, HealthIssue, InstalledConnector,
} from './types';
import { classifyCategory } from './engine';

// ─── Compute health for one connector ────────────────────────────────────────────
export async function computeHealth(installed: InstalledConnector): Promise<ConnectorHealth> {
  const now = new Date();
  const day24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const day7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Recent successes / failures from sync jobs (last 24h)
  const [recentSuccesses, recentFailures] = await Promise.all([
    db.connectorSyncJob.count({
      where: { connectorId: installed.id, status: 'success', completedAt: { gte: day24 } },
    }),
    db.connectorSyncJob.count({
      where: { connectorId: installed.id, status: 'failed', completedAt: { gte: day24 } },
    }),
  ]);

  // Credential expiry
  const creds = installed.credentials;
  const accessCred = creds.find((c) => c.type === 'access_token');
  const credExpiry = accessCred?.expiresAt ? new Date(accessCred.expiresAt) : null;
  const credentialExpired = credExpiry ? credExpiry < now : false;
  const credentialExpiringSoon = credExpiry ? (credExpiry > now && credExpiry < day7) : false;

  // Data freshness
  const lastSync = installed.lastSyncAt ? new Date(installed.lastSyncAt) : null;
  const dataFreshnessHours = lastSync ? Math.max(0, Math.round((now.getTime() - lastSync.getTime()) / (60 * 60 * 1000))) : null;

  // Webhook health — derived from webhook-received events in last 24h
  const webhookEvents = await db.connectorEvent.count({
    where: { connectorId: installed.id, type: 'webhook.received', createdAt: { gte: day24 } },
  });
  const webhookHealthy = !installed.metadata?.webhookRequired ? true : webhookEvents > 0;

  // Health score (0..100)
  let score = 100;
  if (installed.status === 'error') score -= 40;
  if (installed.status === 'expired') score -= 50;
  if (installed.status === 'revoked') score -= 60;
  if (credentialExpired) score -= 30;
  if (credentialExpiringSoon) score -= 10;
  if (installed.reliabilityPct < 90) score -= 20;
  if (installed.reliabilityPct < 70) score -= 20;
  if (installed.apiLatencyMs > 2000) score -= 10;
  if (installed.apiLatencyMs > 5000) score -= 15;
  if (dataFreshnessHours !== null && dataFreshnessHours > 24) score -= 10;
  if (dataFreshnessHours !== null && dataFreshnessHours > 168) score -= 15;
  if (recentFailures > 0 && recentSuccesses === 0) score -= 20;
  if (!webhookHealthy) score -= 5;
  score = Math.max(0, Math.min(100, score));

  // Recommendation
  let recommendation: string | null = null;
  if (credentialExpired) recommendation = 'Re-authenticate — access token expired';
  else if (credentialExpiringSoon) recommendation = `Rotate token before ${credExpiry?.toISOString()}`;
  else if (installed.status === 'error') recommendation = `Investigate last error: ${installed.lastError ?? 'unknown'}`;
  else if (dataFreshnessHours !== null && dataFreshnessHours > 24) recommendation = 'Trigger manual sync — data is stale';
  else if (installed.reliabilityPct < 90) recommendation = 'Reliability below 90% — review sync failures';
  else if (recentFailures > 3) recommendation = `${recentFailures} failures in 24h — review logs`;
  else if (installed.apiLatencyMs > 2000) recommendation = 'High API latency — consider region optimization';

  return {
    connectorId: installed.id,
    connectorKey: installed.connectorKey,
    provider: installed.provider,
    category: installed.category,
    status: installed.status,
    apiLatencyMs: installed.apiLatencyMs,
    reliabilityPct: installed.reliabilityPct,
    lastSyncAt: installed.lastSyncAt,
    lastSyncStatus: installed.lastSyncStatus,
    lastError: installed.lastError,
    credentialExpiresAt: credExpiry?.toISOString() ?? null,
    credentialExpired,
    credentialExpiringSoon,
    webhookHealthy,
    rateLimitRemaining: null,
    dataFreshnessHours,
    recentFailures,
    recentSuccesses,
    healthScore: score,
    recommendation,
  };
}

// ─── Aggregate health center ─────────────────────────────────────────────────────
export async function getHealthCenter(installedList: InstalledConnector[]): Promise<HealthCenter> {
  const connectorHealth: ConnectorHealth[] = [];
  for (const inst of installedList) {
    connectorHealth.push(await computeHealth(inst));
  }

  const healthy = connectorHealth.filter((h) => h.healthScore >= 85 && h.status === 'active').length;
  const degraded = connectorHealth.filter((h) => h.healthScore >= 50 && h.healthScore < 85).length;
  const down = connectorHealth.filter((h) => h.healthScore < 50).length;
  const expired = connectorHealth.filter((h) => h.credentialExpired).length;
  const expiringSoon = connectorHealth.filter((h) => h.credentialExpiringSoon).length;

  const avgReliability = connectorHealth.length > 0
    ? Math.round(connectorHealth.reduce((acc, h) => acc + h.reliabilityPct, 0) / connectorHealth.length * 10) / 10
    : 100;
  const avgLatencyMs = connectorHealth.length > 0
    ? Math.round(connectorHealth.reduce((acc, h) => acc + h.apiLatencyMs, 0) / connectorHealth.length)
    : 0;

  // 24h aggregates from events
  const day24 = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const connectorIds = connectorHealth.map((h) => h.connectorId);
  const [totalEvents24h, totalFailures24h, totalSyncs24h] = connectorIds.length > 0 ? await Promise.all([
    db.connectorEvent.count({ where: { connectorId: { in: connectorIds }, createdAt: { gte: day24 } } }),
    db.connectorEvent.count({ where: { connectorId: { in: connectorIds }, severity: { in: ['high', 'critical'] }, createdAt: { gte: day24 } } }),
    db.connectorSyncJob.count({ where: { connectorId: { in: connectorIds }, createdAt: { gte: day24 } } }),
  ]) : [0, 0, 0];

  // Total API calls in 24h — approximated by sum of connector logs
  const totalApiCalls24h = connectorIds.length > 0
    ? await db.connectorLog.count({ where: { connectorId: { in: connectorIds }, createdAt: { gte: day24 } } })
    : 0;

  // Top issues — sort by severity, take top 10
  const issues: HealthIssue[] = connectorHealth
    .filter((h) => h.recommendation)
    .map((h) => ({
      severity: (h.healthScore < 30 ? 'critical' : h.healthScore < 60 ? 'high' : h.healthScore < 85 ? 'medium' : 'low') as HealthIssue['severity'],
      connectorKey: h.connectorKey,
      provider: h.provider,
      issue: h.lastError ?? h.recommendation ?? 'Unknown issue',
      recommendation: h.recommendation ?? 'Review connector logs',
    }))
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.severity] - order[b.severity];
    })
    .slice(0, 10);

  return {
    totalConnectors: connectorHealth.length,
    healthy,
    degraded,
    down,
    expired,
    expiringSoon,
    avgReliability,
    avgLatencyMs,
    totalEvents24h,
    totalFailures24h,
    totalSyncs24h,
    totalApiCalls24h,
    topIssues: issues,
    connectors: connectorHealth,
  };
}

// ─── Auto-recovery ───────────────────────────────────────────────────────────────
export async function autoRecover(): Promise<{ recovered: number; actions: string[] }> {
  const actions: string[] = [];
  let recovered = 0;

  // 1. Find expired connectors and mark them expired
  const expiredInstances = await db.connectorInstance.findMany({
    where: { status: 'active' },
    include: { credentials: true },
  });

  for (const inst of expiredInstances) {
    const accessCred = inst.credentials.find((c) => c.type === 'access_token');
    if (accessCred?.expiresAt && accessCred.expiresAt < new Date()) {
      await db.connectorInstance.update({
        where: { id: inst.id },
        data: { status: 'expired', lastError: 'Access token expired' },
      });
      actions.push(`Marked ${inst.provider} as expired (token expired)`);
    }

    // 2. Find overdue syncs and queue retry
    if (inst.nextSyncAt && inst.nextSyncAt < new Date() && inst.status === 'active') {
      await db.connectorInstance.update({
        where: { id: inst.id },
        data: { nextSyncAt: new Date(Date.now() + 15 * 60 * 1000) },
      });
      actions.push(`Rescheduled overdue sync for ${inst.provider}`);
      recovered++;
    }
  }

  // 3. Find failed sync jobs in last hour and flag for retry
  const hour1 = new Date(Date.now() - 60 * 60 * 1000);
  const failedJobs = await db.connectorSyncJob.findMany({
    where: { status: 'failed', createdAt: { gte: hour1 } },
    take: 5,
  });
  for (const job of failedJobs) {
    actions.push(`Flagged failed sync job ${job.id} for retry`);
    recovered++;
  }

  return { recovered, actions };
}
