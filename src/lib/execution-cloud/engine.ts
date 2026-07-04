// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — ENTERPRISE EXECUTION ENGINE™ (Subsystem 1)
// The single global execution pipeline. Every action from every module flows
// through it. Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════
// buildUnifiedJobStream(db) reads REAL activity from 16 source tables across all
// modules (CEOTask, ExecutionTask, AutomationLog, Workflow, GSTRFiling, DevBuild,
// DevDeployment, AutonomousSimulation, CrossBorderSimulation, GlobalExecutiveBrief,
// CommunicationLog, Payment, Payroll, TDSRecord, ReconciliationRun, SyncedRecord)
// and materialises them into ONE unified ExecutionJob[] stream. Explicit
// ExecutionJob rows created via POST /api/execution/run are also folded in.
//
// No mock data. Every job traces back to a real production record.
// ═══════════════════════════════════════════════════════════════════════════════

import type { PrismaClient } from '@prisma/client';
import type {
  ExecutionJob, ExecutionModule, ExecutionStatus, ExecutionPriority,
} from './types';
import { MODULE_META } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeParse(s: string | null): Record<string, unknown> {
  if (!s) return {};
  try { return JSON.parse(s) as Record<string, unknown>; } catch { return {}; }
}

function durationMs(startedAt: Date | null, completedAt: Date | null): number {
  if (!startedAt || !completedAt) return 0;
  return Math.max(0, completedAtAt(completedAt) - completedAtAt(startedAt));
}
function completedAtAt(d: Date): number { return d.getTime(); }

// Map an arbitrary status string to the unified ExecutionStatus vocabulary.
function normaliseStatus(raw: string | null | undefined, fallback: ExecutionStatus = 'completed'): ExecutionStatus {
  if (!raw) return fallback;
  const s = raw.toLowerCase();
  if (['completed', 'complete', 'done', 'success', 'succeeded', 'sent', 'delivered', 'filed', 'approved'].includes(s)) return 'completed';
  if (['failed', 'error', 'rejected', 'invalid'].includes(s)) return 'failed';
  if (['running', 'in_progress', 'in progress', 'pending', 'processing', 'building', 'deploying'].includes(s)) return 'running';
  if (['queued', 'pending_approval', 'awaiting', 'awaiting_approval', 'waiting', 'draft'].includes(s)) return 'queued';
  if (['awaiting approval', 'needs approval', 'approval_required'].includes(s)) return 'awaiting_approval';
  if (['cancelled', 'canceled', 'aborted', 'skipped', 'rolled_back'].includes(s)) return 'cancelled';
  return fallback;
}

function priorityFromRisk(riskScore: number | null | undefined): ExecutionPriority {
  if (riskScore == null) return 'normal';
  if (riskScore >= 70) return 'critical';
  if (riskScore >= 45) return 'high';
  if (riskScore >= 20) return 'normal';
  return 'low';
}

function priorityFromSeverity(sev: string | null | undefined): ExecutionPriority {
  const s = (sev ?? '').toLowerCase();
  if (['critical', 'urgent'].includes(s)) return 'critical';
  if (['high', 'important'].includes(s)) return 'high';
  if (['low', 'info', 'informational'].includes(s)) return 'low';
  return 'normal';
}

function jobFromRow(row: {
  id: string; module: string; type: string; description: string; status: string;
  priority: string; organizationId: string | null; countryIso: string | null;
  entityId: string | null; userId: string | null; aiModule: string | null;
  payload: string; result: string; auditId: string | null; sourceJobId: string | null;
  workerId: string | null; queueName: string; retryCount: number; maxRetries: number;
  durationMs: number; startedAt: Date | null; completedAt: Date | null;
  createdAt: Date; updatedAt: Date;
}): ExecutionJob {
  return {
    id: row.id,
    module: (row.module as ExecutionModule) in MODULE_META ? (row.module as ExecutionModule) : 'automation',
    type: row.type,
    description: row.description,
    status: row.status as ExecutionStatus,
    priority: row.priority as ExecutionPriority,
    organizationId: row.organizationId,
    countryIso: row.countryIso,
    entityId: row.entityId,
    userId: row.userId,
    aiModule: row.aiModule,
    payload: safeParse(row.payload),
    result: safeParse(row.result),
    auditId: row.auditId,
    sourceJobId: row.sourceJobId,
    workerId: row.workerId,
    queueName: row.queueName,
    retryCount: row.retryCount,
    maxRetries: row.maxRetries,
    durationMs: row.durationMs,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── Source-table mappers — each turns a real record into an ExecutionJob ─────
// These are pure (no DB access) so they're trivially testable. Each returns a
// partial that buildUnifiedJobStream stamps with id/module/etc.

interface DerivedJobSeed {
  module: ExecutionModule;
  type: string;
  description: string;
  status: ExecutionStatus;
  priority: ExecutionPriority;
  countryIso?: string | null;
  organizationId?: string | null;
  entityId?: string | null;
  aiModule?: string | null;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  durationMs?: number;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  sourceRef: string;   // for audit trail (e.g. "CEOTask:abc123")
}

// ─── buildUnifiedJobStream — the single source of truth for the pipeline ──────

export async function buildUnifiedJobStream(db: PrismaClient): Promise<ExecutionJob[]> {
  // 1. Read explicit ExecutionJob rows (created via POST /api/execution/run).
  const explicitRows = await db.executionJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  const explicitJobs = explicitRows.map(jobFromRow);

  // 2. Derive jobs from REAL activity across 16 source tables. Each query is
  //    bounded (take 50) so the stream stays responsive even at scale.
  const [
    ceoTasks, execTasks, automationLogs, workflows, gstFilings,
    devBuilds, devDeploys, autoSims, crossBorderSims, executiveBriefs,
    commLogs, payments, payrolls, tdsRecords, reconRuns, syncedRecords,
  ] = await Promise.all([
    db.cEOTask.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    db.executionTask.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    db.automationLog.findMany({ orderBy: { executedAt: 'desc' }, take: 50 }),
    db.workflow.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    db.gSTRFiling.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    db.devBuild.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    db.devDeployment.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    db.autonomousSimulation.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    db.crossBorderSimulation.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    db.globalExecutiveBrief.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    db.communicationLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    db.payment.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    db.payroll.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    db.tDSRecord.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    db.reconciliationRun.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    db.syncedRecord.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);

  const derived: DerivedJobSeed[] = [];

  // ── AI CEO™ tasks ──
  for (const t of ceoTasks) {
    derived.push({
      module: 'ai_ceo',
      type: t.type ?? 'ceo_task',
      description: t.title ?? `CEO task ${t.id}`,
      status: normaliseStatus(t.status, 'queued'),
      priority: priorityFromSeverity(t.priority),
      aiModule: t.owner === 'oracle' ? 'oracle' : 'ai_ceo',
      createdAt: t.createdAt,
      sourceRef: `CEOTask:${t.id}`,
      payload: { type: t.type, deadline: t.deadline ?? null, relatedDecisionId: t.relatedDecisionId ?? null, owner: t.owner },
      result: { status: t.status, businessImpact: t.businessImpact },
    });
  }

  // ── Existing Execution Engine tasks (GST/banking/payroll) ──
  // Map the legacy task type to the new module vocabulary.
  const legacyTypeToModule: Record<string, ExecutionModule> = {
    gst_prepare: 'gst', gst_json: 'gst', download_2b: 'gst',
    bank_reconcile: 'banking', send_invoice: 'crm',
    send_report: 'reports', send_whatsapp: 'crm', send_email: 'crm', send_sms: 'crm',
    run_payroll: 'ai_hr', calc_tds: 'gst',
  };
  for (const t of execTasks) {
    const mod = legacyTypeToModule[t.type] ?? 'automation';
    derived.push({
      module: mod,
      type: t.type,
      description: t.description,
      status: normaliseStatus(t.status, 'queued'),
      priority: priorityFromRisk(t.riskScore),
      aiModule: t.agent,
      createdAt: t.createdAt,
      startedAt: t.startedAt,
      completedAt: t.completedAt,
      durationMs: durationMs(t.startedAt, t.completedAt),
      sourceRef: `ExecutionTask:${t.id}`,
      payload: { decisionId: t.decisionId, riskScore: t.riskScore },
      result: safeParse(typeof t.result === 'string' ? t.result : null),
    });
  }

  // ── Automation™ log ──
  for (const l of automationLogs) {
    derived.push({
      module: 'automation',
      type: l.trigger ? `automation:${l.trigger}` : 'automation',
      description: `Automation rule ${l.ruleId} executed — ${l.trigger}`,
      status: normaliseStatus(l.status, 'completed'),
      priority: 'normal',
      createdAt: l.executedAt,
      sourceRef: `AutomationLog:${l.id}`,
      payload: { ruleId: l.ruleId, trigger: l.trigger },
      result: { status: l.status, details: l.details ?? null },
    });
  }

  // ── Autonomous Enterprise™ workflows ──
  for (const w of workflows) {
    derived.push({
      module: 'autonomous_enterprise',
      type: w.type,
      description: w.name,
      status: normaliseStatus(w.status, 'running'),
      priority: 'high',
      aiModule: 'autonomous_enterprise',
      createdAt: w.createdAt,
      startedAt: w.startedAt,
      completedAt: w.completedAt,
      durationMs: durationMs(w.startedAt, w.completedAt),
      sourceRef: `Workflow:${w.id}`,
      payload: { trigger: w.trigger, currentStep: w.currentStep },
      result: { status: w.status, steps: w.steps },
    });
  }

  // ── GST™ filings ──
  for (const f of gstFilings) {
    derived.push({
      module: 'gst',
      type: `gstr_filing:${f.returnType ?? '3B'}`,
      description: `GSTR-${f.returnType ?? '3B'} filing — ${f.period} (${f.clientId})`,
      status: normaliseStatus(f.status, 'queued'),
      priority: 'high',
      createdAt: f.createdAt,
      sourceRef: `GSTRFiling:${f.id}`,
      payload: { clientId: f.clientId, returnType: f.returnType, period: f.period, totalInvoices: f.totalInvoices, totalTax: f.totalTax },
      result: { status: f.status, acknowledgmentNumber: f.acknowledgmentNumber ?? null, filedDate: f.filedDate ?? null, criticalErrors: f.criticalErrors },
    });
  }

  // ── AI Software Factory™ builds + deploys ──
  for (const b of devBuilds) {
    derived.push({
      module: 'ai_software_factory',
      type: 'build',
      description: `Software Factory build #${b.buildNumber} — ${b.stage} (${b.trigger})`,
      status: normaliseStatus(b.status, 'running'),
      priority: 'normal',
      createdAt: b.createdAt,
      sourceRef: `DevBuild:${b.id}`,
      payload: { projectId: b.projectId, buildNumber: b.buildNumber, stage: b.stage, trigger: b.trigger, triggeredBy: b.triggeredBy },
      result: { status: b.status, durationMs: b.durationMs, errors: b.errors, warnings: b.warnings },
      durationMs: b.durationMs,
    });
  }
  for (const d of devDeploys) {
    derived.push({
      module: 'ai_software_factory',
      type: 'deploy',
      description: `Software Factory deployment — ${d.environment} (${d.strategy})`,
      status: normaliseStatus(d.status, 'completed'),
      priority: 'high',
      createdAt: d.createdAt,
      sourceRef: `DevDeployment:${d.id}`,
      payload: { projectId: d.projectId, buildId: d.buildId, environment: d.environment, strategy: d.strategy, region: d.region },
      result: { status: d.status, url: d.url ?? null, replicas: d.replicas, uptimePct: d.uptimePct },
    });
  }

  // ── Autonomous Enterprise™ simulations ──
  for (const s of autoSims) {
    derived.push({
      module: 'autonomous_enterprise',
      type: 'simulate',
      description: `Autonomous simulation — ${s.title ?? s.scenario}`,
      status: normaliseStatus(s.status, 'completed'),
      priority: 'normal',
      createdAt: s.createdAt,
      sourceRef: `AutonomousSimulation:${s.id}`,
      payload: { scenario: s.scenario, confidence: s.confidence },
      result: { recommendation: s.recommendation, status: s.status },
    });
  }

  // ── Global Enterprise™ cross-border simulations ──
  for (const s of crossBorderSims) {
    derived.push({
      module: 'global_enterprise',
      type: 'cross_border_simulate',
      description: `Cross-border simulation — ${s.scenarioName ?? s.scenarioType}`,
      status: 'completed',
      priority: 'normal',
      countryIso: s.targetCountryIso ?? null,
      createdAt: s.createdAt,
      sourceRef: `CrossBorderSimulation:${s.id}`,
      payload: { scenarioType: s.scenarioType, targetCountryIso: s.targetCountryIso, entityId: s.entityId },
      result: { verdict: s.verdict, roiPct: s.roiPct, riskScore: s.riskScore },
    });
  }

  // ── Global Enterprise™ executive briefs ──
  for (const b of executiveBriefs) {
    derived.push({
      module: 'global_enterprise',
      type: 'executive_brief',
      description: `${b.executiveRole?.toUpperCase()} brief — ${b.headline}`,
      status: 'completed',
      priority: 'high',
      aiModule: b.executiveRole ?? null,
      entityId: b.entityId,
      countryIso: null,
      createdAt: b.createdAt,
      sourceRef: `GlobalExecutiveBrief:${b.id}`,
      payload: { executiveRole: b.executiveRole, briefDate: b.briefDate, contextScope: b.contextScope },
      result: { headline: b.headline, confidencePct: b.confidencePct, keyActions: b.keyActions, risks: b.risks, opportunities: b.opportunities },
    });
  }

  // ── Communication logs (CRM) ──
  for (const c of commLogs) {
    derived.push({
      module: 'crm',
      type: `comm:${c.channel ?? 'email'}`,
      description: `${c.channel ?? 'Message'} — ${c.eventType ?? 'event'} → ${c.recipientName ?? c.recipient}`,
      status: normaliseStatus(c.status, 'completed'),
      priority: 'normal',
      createdAt: c.createdAt,
      sourceRef: `CommunicationLog:${c.id}`,
      payload: { channel: c.channel, eventType: c.eventType, templateName: c.templateName, triggerSource: c.triggerSource, clientId: c.clientId },
      result: { status: c.status, recipient: c.recipient },
    });
  }

  // ── Banking™ payments ──
  for (const p of payments) {
    derived.push({
      module: 'banking',
      type: `payment:${p.paymentMode ?? 'upi'}`,
      description: `Payment ₹${p.amount ?? 0} — ${p.paymentMode ?? 'UPI'} → ${p.partyName}`,
      status: normaliseStatus(p.status, 'completed'),
      priority: p.status === 'failed' ? 'high' : 'normal',
      createdAt: p.createdAt,
      sourceRef: `Payment:${p.id}`,
      payload: { invoiceId: p.invoiceId, purchaseBillId: p.purchaseBillId, paymentMode: p.paymentMode, amount: p.amount, partyType: p.partyType },
      result: { status: p.status, referenceNo: p.referenceNo ?? null, reconciled: p.reconciled },
    });
  }

  // ── Payroll (AI HR™) ──
  for (const p of payrolls) {
    derived.push({
      module: 'ai_hr',
      type: 'payroll_run',
      description: `Payroll — ${p.period} → employee ${p.employeeId} (₹${p.netSalary ?? 0} net)`,
      status: normaliseStatus(p.status, 'completed'),
      priority: 'high',
      aiModule: 'ai_hr',
      createdAt: p.createdAt,
      sourceRef: `Payroll:${p.id}`,
      payload: { employeeId: p.employeeId, period: p.period },
      result: { status: p.status, grossSalary: p.grossSalary, netSalary: p.netSalary, pf: p.pf, tds: p.tds, paidAt: p.paidAt },
    });
  }

  // ── TDS records (GST/Tax) ──
  for (const t of tdsRecords) {
    derived.push({
      module: 'gst',
      type: 'tds_record',
      description: `TDS ${t.section} — ₹${t.tdsAmount ?? 0} on ₹${t.paymentAmount ?? 0} → ${t.deducteeName}`,
      status: normaliseStatus(t.status, 'completed'),
      priority: 'high',
      createdAt: t.createdAt,
      sourceRef: `TDSRecord:${t.id}`,
      payload: { section: t.section, deducteeName: t.deducteeName, paymentAmount: t.paymentAmount, tdsRate: t.tdsRate, tdsAmount: t.tdsAmount, quarter: t.quarter },
      result: { status: t.status },
    });
  }

  // ── Bank reconciliation runs ──
  for (const r of reconRuns) {
    derived.push({
      module: 'banking',
      type: 'reconcile',
      description: `Reconciliation run — ${r.period} (${r.matched} matched / ${r.unmatched} unmatched)`,
      status: normaliseStatus(r.status, 'completed'),
      priority: 'normal',
      createdAt: r.createdAt,
      sourceRef: `ReconciliationRun:${r.id}`,
      payload: { clientId: r.clientId, period: r.period, sources: r.sources, totalRecords: r.totalRecords },
      result: { status: r.status, matched: r.matched, unmatched: r.unmatched, partialMatches: r.partialMatches, highRisk: r.highRisk, gstDifference: r.gstDifference },
    });
  }

  // ── Connectivity Fabric™ synced records ──
  for (const s of syncedRecords) {
    derived.push({
      module: 'connectivity_fabric',
      type: 'connector_sync',
      description: `Connector sync — ${s.sourceType} (${s.title ?? s.externalId ?? 'record'})`,
      status: s.processed ? 'completed' : 'queued',
      priority: 'normal',
      createdAt: s.createdAt,
      sourceRef: `SyncedRecord:${s.id}`,
      payload: { connectionId: s.connectionId, sourceType: s.sourceType, externalId: s.externalId, category: s.category, amount: s.amount },
      result: { processed: s.processed, title: s.title },
    });
  }

  // 3. Materialise derived seeds into ExecutionJob-shaped objects. These are NOT
  //    persisted to the ExecutionJob table (they're a read-model projection of
  //    real source rows) — but they share the same type so the dashboard treats
  //    them uniformly. Explicit rows always win on id collision.
  const explicitIds = new Set(explicitJobs.map((j) => j.id));
  const derivedJobs: ExecutionJob[] = derived
    .filter((d) => !explicitIds.has(d.sourceRef))
    .map((d): ExecutionJob => ({
      id: d.sourceRef,
      module: d.module,
      type: d.type,
      description: d.description,
      status: d.status,
      priority: d.priority,
      organizationId: d.organizationId ?? null,
      countryIso: d.countryIso ?? null,
      entityId: d.entityId ?? null,
      userId: null,
      aiModule: d.aiModule ?? null,
      payload: d.payload ?? {},
      result: d.result ?? {},
      auditId: null,
      sourceJobId: null,
      workerId: null,
      queueName: 'default',
      retryCount: 0,
      maxRetries: 3,
      durationMs: d.durationMs ?? 0,
      startedAt: d.startedAt ? d.startedAt.toISOString() : null,
      completedAt: d.completedAt ? d.completedAt.toISOString() : null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.createdAt.toISOString(),
    }));

  // 4. Merge, sort most-recent-first, cap at 500 for dashboard responsiveness.
  const all = [...explicitJobs, ...derivedJobs];
  all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return all.slice(0, 500);
}

// ─── Pipeline rollup — totals + byModule + byPriority + byStatus ──────────────

export function rollupPipeline(jobs: ExecutionJob[]): {
  totals: {
    totalJobs: number; queued: number; running: number; completed: number;
    failed: number; awaitingApproval: number; cancelled: number;
  };
  byModule: { module: ExecutionModule; label: string; jobs: number; successRate: number; avgDurationMs: number; color: string }[];
  byPriority: Record<ExecutionPriority, number>;
  byStatus: Record<ExecutionStatus, number>;
} {
  const totals = {
    totalJobs: jobs.length, queued: 0, running: 0, completed: 0,
    failed: 0, awaitingApproval: 0, cancelled: 0,
  };
  const byPriority: Record<ExecutionPriority, number> = {
    critical: 0, high: 0, normal: 0, low: 0, deferred: 0,
  };
  const byStatus: Record<ExecutionStatus, number> = {
    queued: 0, running: 0, completed: 0, failed: 0, awaiting_approval: 0, cancelled: 0,
  };
  const moduleAgg = new Map<ExecutionModule, { jobs: number; completed: number; failed: number; totalDur: number }>();

  for (const j of jobs) {
    byPriority[j.priority] += 1;
    byStatus[j.status] += 1;
    switch (j.status) {
      case 'queued': totals.queued += 1; break;
      case 'running': totals.running += 1; break;
      case 'completed': totals.completed += 1; break;
      case 'failed': totals.failed += 1; break;
      case 'awaiting_approval': totals.awaitingApproval += 1; break;
      case 'cancelled': totals.cancelled += 1; break;
    }
    const a = moduleAgg.get(j.module) ?? { jobs: 0, completed: 0, failed: 0, totalDur: 0 };
    a.jobs += 1;
    if (j.status === 'completed') a.completed += 1;
    if (j.status === 'failed') a.failed += 1;
    a.totalDur += j.durationMs;
    moduleAgg.set(j.module, a);
  }

  const byModule = Array.from(moduleAgg.entries())
    .map(([module, a]) => ({
      module,
      label: MODULE_META[module]?.label ?? module,
      jobs: a.jobs,
      successRate: a.completed + a.failed > 0 ? Math.round((a.completed / (a.completed + a.failed)) * 1000) / 10 : 0,
      avgDurationMs: a.jobs > 0 ? Math.round(a.totalDur / a.jobs) : 0,
      color: MODULE_META[module]?.color ?? 'text-slate-600',
    }))
    .sort((x, y) => y.jobs - x.jobs);

  return { totals, byModule, byPriority, byStatus };
}

// ─── Oracle narrative — derived from the real job stream, never mocked ────────

export function buildOracleNarrative(
  jobs: ExecutionJob[],
  totals: { totalJobs: number; queued: number; running: number; completed: number; failed: number; awaitingApproval: number },
  workerCount: number,
  openAlerts: number,
): string {
  if (jobs.length === 0) {
    return 'Enterprise Execution Cloud™ is in setup phase. As modules produce activity (GST filings, payroll runs, banking payments, AI executive briefs, software factory builds), every action will flow through one unified execution pipeline. Connect integrations and run workflows to activate real-time observability.';
  }
  const topModule = (() => {
    const m = new Map<ExecutionModule, number>();
    for (const j of jobs) m.set(j.module, (m.get(j.module) ?? 0) + 1);
    let best: [ExecutionModule, number] | null = null;
    for (const [k, v] of m) if (!best || v > best[1]) best = [k, v];
    return best;
  })();
  const successRate = totals.completed + totals.failed > 0
    ? Math.round((totals.completed / (totals.completed + totals.failed)) * 1000) / 10
    : 0;
  const parts: string[] = [];
  parts.push(`Enterprise Execution Cloud™ is orchestrating ${jobs.length} executions across ${new Set(jobs.map((j) => j.module)).size} modules.`);
  parts.push(`${totals.running} running, ${totals.queued} queued, ${totals.completed} completed, ${totals.failed} failed, ${totals.awaitingApproval} awaiting approval.`);
  parts.push(`Success rate ${successRate}%.`);
  if (topModule) parts.push(`Most active module: ${MODULE_META[topModule[0]]?.label ?? topModule[0]} (${topModule[1]} executions).`);
  parts.push(`${workerCount} workers online, ${openAlerts} open alerts.`);
  return parts.join(' ');
}
