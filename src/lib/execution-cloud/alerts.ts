// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE EXECUTION CLOUD™ — Subsystem 7: GLOBAL ALERT CENTER™
// Automatically detects: failed workflows, slow connectors, AI failures, job
// failures, queue congestion, missing approvals, failed deployments, payment
// failures, compliance failures. Oracle proposes fixes automatically.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { PrismaClient } from '@prisma/client';
import type {
  ExecutionJob, ExecutionAlert, AlertType, AlertSeverity,
  AlertCenterSummary, ExecutionModule,
} from './types';

export async function buildAlerts(
  db: PrismaClient,
  jobs: ExecutionJob[],
  queueSize: number,
): Promise<AlertCenterSummary> {
  // 1. Explicit alert rows.
  const rows = await db.executionAlert.findMany({
    orderBy: { detectedAt: 'desc' },
    take: 100,
  });
  const explicit: ExecutionAlert[] = rows.map((r) => ({
    id: r.id,
    severity: r.severity as AlertSeverity,
    type: r.type as AlertType,
    title: r.title,
    description: r.description,
    moduleId: (r.moduleId as ExecutionModule | null) ?? null,
    jobId: r.jobId,
    proposedFix: r.proposedFix,
    status: r.status as 'open' | 'acknowledged' | 'resolved',
    detectedAt: r.detectedAt.toISOString(),
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
  }));

  // 2. Auto-detected alerts derived from the REAL job stream.
  const detected = detectAlerts(jobs, queueSize);

  const all = [...explicit, ...detected]
    .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());

  const byType = {} as Record<AlertType, number>;
  const bySeverity = {} as Record<AlertSeverity, number>;
  const byModule: Record<string, number> = {};
  for (const t of ['workflow_failed','connector_slow','ai_failure','job_failed','queue_congested','missing_approval','deployment_failed','payment_failed','compliance_failed'] as AlertType[]) byType[t] = 0;
  for (const s of ['critical','high','medium','low'] as AlertSeverity[]) bySeverity[s] = 0;
  let open = 0, critical = 0;
  for (const a of all) {
    byType[a.type] = (byType[a.type] ?? 0) + 1;
    bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;
    if (a.moduleId) byModule[a.moduleId] = (byModule[a.moduleId] ?? 0) + 1;
    if (a.status === 'open') {
      open += 1;
      if (a.severity === 'critical') critical += 1;
    }
  }

  return {
    total: all.length,
    open,
    critical,
    byType,
    bySeverity,
    byModule,
    recent: all.slice(0, 25),
  };
}

function detectAlerts(jobs: ExecutionJob[], queueSize: number): ExecutionAlert[] {
  const alerts: ExecutionAlert[] = [];
  const now = new Date().toISOString();

  // Group failures by module to detect patterns.
  const failedByModule = new Map<ExecutionModule, ExecutionJob[]>();
  for (const j of jobs) {
    if (j.status === 'failed') {
      const arr = failedByModule.get(j.module) ?? [];
      arr.push(j);
      failedByModule.set(j.module, arr);
    }
  }

  for (const [module, failed] of failedByModule) {
    if (failed.length === 0) continue;
    const latest = failed[0];
    const type: AlertType =
      module === 'ai_software_factory' && latest.type === 'deploy' ? 'deployment_failed' :
      module === 'banking' ? 'payment_failed' :
      module === 'gst' ? 'compliance_failed' :
      ['oracle','ai_ceo','ai_cfo','ai_coo','ai_cto','ai_cro','ai_legal','ai_hr','ai_marketing','ai_operations'].includes(module) ? 'ai_failure' :
      module === 'automation' || module === 'autonomous_enterprise' ? 'workflow_failed' :
      'job_failed';
    const severity: AlertSeverity = failed.length >= 3 ? 'critical' : failed.length >= 2 ? 'high' : 'medium';
    alerts.push({
      id: `auto-fail-${module}`,
      severity,
      type,
      title: `${failed.length} failed ${module} execution${failed.length > 1 ? 's' : ''}`,
      description: latest.description,
      moduleId: module,
      jobId: latest.id,
      proposedFix: proposeFix(type, module, latest),
      status: 'open',
      detectedAt: latest.updatedAt,
      resolvedAt: null,
    });
  }

  // Queue congestion — if queue size is large relative to worker capacity.
  if (queueSize > 20) {
    alerts.push({
      id: 'auto-queue-congestion',
      severity: queueSize > 50 ? 'critical' : 'high',
      type: 'queue_congested',
      title: `Queue congestion — ${queueSize} jobs waiting`,
      description: `${queueSize} jobs are queued across all queues. Workers may be under-provisioned.`,
      moduleId: null,
      jobId: null,
      proposedFix: 'Scale out worker capacity or reprioritise queued jobs. Consider promoting high-priority jobs and deferring low-priority ones.',
      status: 'open',
      detectedAt: now,
      resolvedAt: null,
    });
  }

  // Missing approvals — jobs awaiting approval for too long.
  const awaiting = jobs.filter((j) => j.status === 'awaiting_approval');
  if (awaiting.length > 0) {
    const stale = awaiting.filter((j) => {
      const ageHrs = (Date.now() - new Date(j.createdAt).getTime()) / 3600000;
      return ageHrs > 1;
    });
    if (stale.length > 0) {
      alerts.push({
        id: 'auto-missing-approval',
        severity: stale.length >= 3 ? 'high' : 'medium',
        type: 'missing_approval',
        title: `${stale.length} approval${stale.length > 1 ? 's' : ''} pending > 1 hour`,
        description: stale[0].description,
        moduleId: stale[0].module,
        jobId: stale[0].id,
        proposedFix: 'Notify the designated approver via email + WhatsApp. Consider auto-approving low-risk jobs under the policy threshold.',
        status: 'open',
        detectedAt: now,
        resolvedAt: null,
      });
    }
  }

  // Slow connectors — connectivity_fabric jobs with high latency.
  const slowConnectors = jobs.filter((j) =>
    j.module === 'connectivity_fabric' && j.durationMs > 5000 && j.status === 'completed',
  );
  if (slowConnectors.length >= 2) {
    alerts.push({
      id: 'auto-connector-slow',
      severity: 'medium',
      type: 'connector_slow',
      title: `${slowConnectors.length} slow connector syncs (>5s)`,
      description: slowConnectors[0].description,
      moduleId: 'connectivity_fabric',
      jobId: slowConnectors[0].id,
      proposedFix: 'Increase connector worker pool size and enable response caching for read-heavy endpoints.',
      status: 'open',
      detectedAt: now,
      resolvedAt: null,
    });
  }

  return alerts;
}

function proposeFix(type: AlertType, module: ExecutionModule, job: ExecutionJob): string {
  switch (type) {
    case 'deployment_failed':
      return 'Roll back to the last green deployment via the Software Factory release manager, then re-run the build with verbose logging to capture the failure cause.';
    case 'payment_failed':
      return 'Retry the payment with an alternate bank account or payment method. Verify the beneficiary IFSC/account number and check the bank connector for downtime.';
    case 'compliance_failed':
      return `Re-prepare the ${module === 'gst' ? 'GST return' : 'compliance filing'} from the latest source data. Validate the JSON payload against the portal schema before re-submitting.`;
    case 'ai_failure':
      return `Re-invoke the ${module} executive with a trimmed context window. If the failure persists, fall back to the deterministic policy path and log the prompt for review.`;
    case 'workflow_failed':
      return 'Pause the workflow, inspect the failed step\'s trace via Execution Replay™, then resume from the last successful checkpoint.';
    case 'job_failed':
      return `Retry the job (attempt ${job.retryCount + 1}/${job.maxRetries}). If it fails again, inspect the trace and escalate to the module owner.`;
    default:
      return 'Investigate the execution trace and apply the module-specific remediation runbook.';
  }
}
