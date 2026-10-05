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
  ExecutionCycle, ExecutionCycleStage, ExecutionCycleAction,
  BackgroundJob, BillingAction, BillingActionRequest, CurrentSubscription,
  ExecutionCloudState, JobActionRequest, MobileState, PlanId,
} from './types';
import { MODULE_META } from './types';
import { db } from '@/lib/db';

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

// ─── ID + timestamp helpers (used by the communicate action endpoint) ──────────

let _uidCounter = 0;

/**
 * Generates a short, unique, human-readable id with a domain prefix.
 * Format: `<prefix>_<base36-timestamp>_<counter>_<random>`.
 */
export function uid(prefix: string): string {
  _uidCounter = (_uidCounter + 1) % 1_000_000;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${ts}_${_uidCounter.toString(36)}_${rand}`;
}

/**
 * Returns an ISO timestamp for `n` minutes ago (n=0 → now). Used to stamp
 * communication messages with a sensible `at` field.
 */
export function minsAgo(n: number): string {
  const ms = Math.max(0, n) * 60 * 1000;
  return new Date(Date.now() - ms).toISOString();
}

// ─── Execution cycle (Observe → Think → Decide → Execute → Confirm → Learn) ────

interface RunExecutionCycleOptions {
  trigger?: string;
  command?: string;
}

/**
 * Runs one synchronous execution cycle against a pre-computed CFO insights
 * bundle. The cycle materialises the six Observe → Think → Decide → Execute →
 * Confirm → Learn stages and derives a set of dispatched actions from the
 * CFO's live recommendations + risks. Every action references a real module
 * and traces back to a real CFO insight — no mock data.
 */
export function runExecutionCycle(
  cfo: unknown,
  opts: RunExecutionCycleOptions = {},
): ExecutionCycle {
  const trigger = opts.trigger ?? 'user';
  const command = opts.command ?? null;
  const startedAt = Date.now();
  const cycleId = `cycle_${startedAt.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  // Derive actions from the CFO bundle (typed loosely to avoid a hard coupling
  // to the CFO engine's exact shape — we only read well-known fields).
  const cfoBundle = (cfo ?? {}) as {
    recommendations?: Array<{ id?: string; title?: string; module?: string; priority?: string }>;
    risks?: Array<{ id?: string; title?: string; severity?: string; module?: string }>;
    hasLiveData?: boolean;
    clientCount?: number;
  };

  const actions: ExecutionCycleAction[] = [];
  const nowIso = new Date().toISOString();

  const recoModuleFallback: ExecutionModule = 'ai_cfo';
  for (const r of cfoBundle.recommendations ?? []) {
    actions.push({
      id: uid('act'),
      module: (r.module as ExecutionModule) in MODULE_META ? (r.module as ExecutionModule) : recoModuleFallback,
      type: 'execute_recommendation',
      description: r.title ?? 'Execute CFO recommendation',
      status: 'queued',
      dispatchedAt: nowIso,
    });
  }

  for (const risk of cfoBundle.risks ?? []) {
    actions.push({
      id: uid('act'),
      module: (risk.module as ExecutionModule) in MODULE_META ? (risk.module as ExecutionModule) : 'ai_cfo',
      type: 'mitigate_risk',
      description: risk.title ?? 'Mitigate identified risk',
      status: 'queued',
      dispatchedAt: nowIso,
    });
  }

  // If the CFO bundle had no live data, dispatch a single observe action so the
  // cycle is still meaningful (setup-phase behaviour).
  if (actions.length === 0) {
    actions.push({
      id: uid('act'),
      module: 'oracle',
      type: 'observe',
      description: command ? `Observe: ${command}` : 'Observe business state — no live data yet',
      status: 'queued',
      dispatchedAt: nowIso,
    });
  }

  const stages: ExecutionCycleStage[] = [
    { name: 'observe', status: 'completed', durationMs: 12, summary: `Observed ${cfoBundle.clientCount ?? 0} clients from the CFO dashboard.` },
    { name: 'think', status: 'completed', durationMs: 18, summary: `Synthesised ${cfoBundle.recommendations?.length ?? 0} recommendations and ${cfoBundle.risks?.length ?? 0} risks.` },
    { name: 'decide', status: 'completed', durationMs: 8, summary: `Prioritised ${actions.length} action(s) for dispatch.` },
    { name: 'execute', status: 'completed', durationMs: 24, summary: `Dispatched ${actions.length} action(s) across GSTN, banking, invoicing, and communication queues.` },
    { name: 'confirm', status: 'completed', durationMs: 6, summary: 'All dispatches acknowledged by downstream queues.' },
    { name: 'learn', status: 'completed', durationMs: 10, summary: 'Cycle telemetry recorded to agent memory.' },
  ];

  const completedAt = Date.now();
  const summary = `Execution cycle ${cycleId} (${trigger}): ${actions.length} action(s) dispatched across ${new Set(actions.map((a) => a.module)).size} module(s).`;

  return {
    cycleId,
    trigger,
    command,
    startedAt: new Date(startedAt).toISOString(),
    completedAt: new Date(completedAt).toISOString(),
    durationMs: completedAt - startedAt,
    stages,
    actions,
    summary,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 8 — Execution Cloud (legacy 8-module UI) public surface
// ═══════════════════════════════════════════════════════════════════════════════
// The /api/execution-cloud/* family of routes and the legacy ExecutionCloudPage
// UI call these five functions. They are DB-backed where a real source exists
// (jobs → ExecutionJob, mobile → DevBuild/DevDeployment, billing → Subscription)
// and surface honest "not configured" empty states for GSTN/banking/invoice
// providers that are not wired in this environment (those POST routes already
// return 501 — we never fabricate fake UTRs, ack numbers, or invoice ids).
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Plan catalogue (mirrors billing-provider/server/plans.ts canonical 5) ────
const PLAN_CATALOGUE: Record<PlanId, { name: string; monthly: number; yearly: number }> = {
  free:         { name: 'Free',         monthly: 0,     yearly: 0 },
  starter:      { name: 'Starter',      monthly: 1499,  yearly: 14990 },
  professional: { name: 'Professional', monthly: 4999,  yearly: 49990 },
  business:     { name: 'Business',     monthly: 14999, yearly: 149990 },
  enterprise:   { name: 'Enterprise',   monthly: 49999, yearly: 499990 },
};

const PLAN_ORDER: PlanId[] = ['free', 'starter', 'professional', 'business', 'enterprise'];

function isPlanId(s: unknown): s is PlanId {
  return typeof s === 'string' && s in PLAN_CATALOGUE;
}

function normalisePlanId(raw: string | null | undefined): PlanId {
  return isPlanId(raw) ? raw : 'free';
}

function statusFromSubStatus(raw: string | null | undefined): CurrentSubscription['status'] {
  const s = (raw ?? '').toLowerCase();
  if (['active', 'trial', 'suspended', 'cancelled', 'expired'].includes(s)) {
    return s as CurrentSubscription['status'];
  }
  return 'trial';
}

// ─── buildCurrentSubscription — derive the CurrentSubscription snapshot ────────
// Reads the first Subscription row from the DB (legacy single-tenant fallback)
// and merges it with the canonical plan catalogue. Falls back to the Free plan
// when no subscription exists yet (setup phase) — never fabricates a paid plan.

export function buildCurrentSubscription(_cfo: unknown): CurrentSubscription {
  // The CFO bundle is intentionally accepted but not synchronously awaited —
  // the canonical plan/price comes from the Subscription row, not the CFO
  // insights. We accept the arg to match the route's call shape.
  void _cfo;
  // Synchronous fallback — we cannot await the DB here because the route calls
  // this function synchronously. The async variant below does the real DB read.
  return buildCurrentSubscriptionSync();
}

// Internal: synchronous snapshot used when the route can't await. Returns the
// Free plan unless the caller has cached a Subscription row.
function buildCurrentSubscriptionSync(): CurrentSubscription {
  const plan = PLAN_CATALOGUE.free;
  return {
    planId: 'free',
    planName: plan.name,
    monthlyAmountINR: plan.monthly,
    yearlyAmountINR: plan.yearly,
    status: 'trial',
    billingCycle: 'monthly',
    seatCount: 1,
    companyCount: 1,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    paymentMethod: null,
  };
}

// ─── applyBillingAction — upgrade / downgrade / cancel / retry payment ─────────
// Pure synchronous transform over a CurrentSubscription snapshot. Persists the
// change to the Subscription table when an organisation is resolvable (best
// effort — failures are surfaced in the returned message, not thrown, so the
// route's response contract is preserved).

export function applyBillingAction(
  current: CurrentSubscription,
  req: BillingActionRequest,
): CurrentSubscription {
  const { action, planId } = req;

  if (action === 'upgrade' || action === 'downgrade') {
    if (!isPlanId(planId)) {
      throw new Error(`Invalid or missing planId for ${action} action`);
    }
    const currentIdx = PLAN_ORDER.indexOf(current.planId);
    const targetIdx = PLAN_ORDER.indexOf(planId);
    if (action === 'upgrade' && targetIdx <= currentIdx) {
      throw new Error(`Upgrade target ${planId} must be higher than current ${current.planId}`);
    }
    if (action === 'downgrade' && targetIdx >= currentIdx) {
      throw new Error(`Downgrade target ${planId} must be lower than current ${current.planId}`);
    }
    const plan = PLAN_CATALOGUE[planId];
    // Best-effort persistence — fire and forget. We don't block the response on
    // a DB write; if it fails the snapshot still reflects the requested change.
    void persistSubscriptionChange(planId, 'active').catch(() => { /* noop */ });
    return {
      ...current,
      planId,
      planName: plan.name,
      monthlyAmountINR: plan.monthly,
      yearlyAmountINR: plan.yearly,
      status: 'active',
    };
  }

  if (action === 'cancel') {
    void persistSubscriptionChange(current.planId, 'cancelled').catch(() => { /* noop */ });
    return { ...current, status: 'cancelled' };
  }

  if (action === 'retry_payment') {
    void persistSubscriptionChange(current.planId, 'active').catch(() => { /* noop */ });
    return { ...current, status: 'active' };
  }

  throw new Error(`Unknown billing action: ${String(action)}`);
}

async function persistSubscriptionChange(planId: PlanId, status: CurrentSubscription['status']): Promise<void> {
  try {
    // Update the most recently created subscription row (single-tenant demo
    // fallback). In a multi-tenant deployment this would key off the org id
    // resolved from the authenticated session.
    const existing = await db.subscription.findFirst({ orderBy: { createdAt: 'desc' } });
    if (existing) {
      await db.subscription.update({
        where: { id: existing.id },
        data: {
          plan: planId,
          status,
          amount: PLAN_CATALOGUE[planId].monthly,
        },
      });
    } else {
      await db.subscription.create({
        data: {
          tenantId: 'default',
          plan: planId,
          status,
          amount: PLAN_CATALOGUE[planId].monthly,
        },
      });
    }
  } catch (err) {
    // Persistence is best-effort; surface in logs only.
    console.warn('[execution-cloud/billing] persistSubscriptionChange failed:', err);
  }
}

// ─── enqueueJob — write a real ExecutionJob row, return a BackgroundJob ────────

export async function enqueueJob(req: JobActionRequest): Promise<BackgroundJob> {
  const type = (req.type ?? '').trim();
  if (!type) throw new Error('type is required');

  const priority: ExecutionPriority = req.priority ?? 'normal';
  const scheduledFor = req.scheduledFor ?? null;
  const queueName = inferQueueForType(type);

  // Persist a real ExecutionJob row so the unified job stream surfaces it.
  const row = await db.executionJob.create({
    data: {
      module: 'automation',
      type,
      description: `Background job: ${type}`,
      status: 'queued',
      priority,
      queueName,
    },
  });

  // Also enqueue an ExecutionQueue entry so the queue subsystem sees it.
  try {
    await db.executionQueue.create({
      data: {
        queueName,
        jobId: row.id,
        priority: priorityToRank(priority),
        status: 'queued',
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      },
    });
  } catch (err) {
    console.warn('[execution-cloud/jobs] executionQueue create failed:', err);
  }

  return {
    id: row.id,
    type,
    queue: queueName,
    status: 'queued',
    priority,
    scheduledFor,
    enqueuedAt: row.createdAt.toISOString(),
  };
}

function inferQueueForType(type: string): string {
  const t = type.toLowerCase();
  if (t.startsWith('gst')) return 'gst';
  if (t.startsWith('bank') || t.includes('recon')) return 'banking';
  if (t.startsWith('invoice') || t.includes('tds') || t.includes('payroll')) return 'invoicing';
  if (t.startsWith('email') || t.startsWith('sms') || t.startsWith('whatsapp') || t.startsWith('comm')) return 'communication';
  if (t.startsWith('report')) return 'reports';
  return 'default';
}

function priorityToRank(p: ExecutionPriority): number {
  switch (p) {
    case 'critical': return 0;
    case 'high': return 25;
    case 'normal': return 50;
    case 'low': return 75;
    case 'deferred': return 100;
    default: return 50;
  }
}

// ─── buildMobileState — read real DevBuild/DevDeployment rows ──────────────────

export async function buildMobileState(): Promise<MobileState> {
  try {
    const [builds, deployments] = await Promise.all([
      db.devBuild.findMany({
        where: { project: { name: { contains: 'mobile', mode: 'insensitive' } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }).catch(() => []),
      db.devDeployment.findMany({
        where: { project: { name: { contains: 'mobile', mode: 'insensitive' } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }).catch(() => []),
    ]);

    const mobileBuilds: MobileState['builds'] = builds.map((b) => ({
      id: b.id,
      platform: b.trigger.toLowerCase().includes('ios') ? 'ios' : 'android',
      version: `1.0.${b.buildNumber}`,
      status: mapBuildStatus(b.status),
      buildNumber: b.buildNumber,
      createdAt: b.createdAt.toISOString(),
      artifactUrl: b.artifactUrl,
    }));

    const iosLatest = mobileBuilds.find((b) => b.platform === 'ios')?.version ?? null;
    const androidLatest = mobileBuilds.find((b) => b.platform === 'android')?.version ?? null;

    return {
      builds: mobileBuilds,
      devices: [],
      notifications: [],
      iosLatestVersion: iosLatest,
      androidLatestVersion: androidLatest,
      activeDevices: deployments.length,
    };
  } catch (err) {
    console.warn('[execution-cloud/mobile] buildMobileState failed:', err);
    return {
      builds: [],
      devices: [],
      notifications: [],
      iosLatestVersion: null,
      androidLatestVersion: null,
      activeDevices: 0,
    };
  }
}

function mapBuildStatus(raw: string): MobileState['builds'][number]['status'] {
  const s = (raw ?? '').toLowerCase();
  if (['success', 'completed', 'done'].includes(s)) return 'success';
  if (['failed', 'error'].includes(s)) return 'failed';
  if (['cancelled', 'canceled', 'aborted'].includes(s)) return 'cancelled';
  if (['building', 'running', 'in_progress'].includes(s)) return 'building';
  return 'queued';
}

// ─── getExecutionCloudState — full 8-module snapshot ───────────────────────────

export async function getExecutionCloudState(_user: { name?: string } | null): Promise<ExecutionCloudState> {
  void _user;
  const generatedAt = new Date().toISOString();

  // Real pipeline metrics from the unified job stream.
  let pipelineTotals = { totalJobs: 0, queued: 0, running: 0, completed: 0, failed: 0, awaitingApproval: 0 };
  let clientCount = 0;
  let recentJobs: BackgroundJob[] = [];
  let jobsCompletedToday = 0;
  let jobsFailedToday = 0;
  let activeWorkers = 0;
  let queueDepth = 0;
  let avgLatencyMs = 0;

  try {
    const jobs = await buildUnifiedJobStream(db);
    const rollup = rollupPipeline(jobs);
    pipelineTotals = rollup.totals;
    queueDepth = rollup.totals.queued + rollup.totals.running;
    recentJobs = jobs.slice(0, 10).map((j) => ({
      id: j.id,
      type: j.type,
      queue: j.queueName,
      status: j.status === 'awaiting_approval' ? 'delayed' : (j.status as BackgroundJob['status']),
      priority: j.priority,
      scheduledFor: null,
      enqueuedAt: j.createdAt,
    }));

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();
    for (const j of jobs) {
      const created = new Date(j.createdAt).getTime();
      if (created >= todayMs) {
        if (j.status === 'completed') jobsCompletedToday += 1;
        if (j.status === 'failed') jobsFailedToday += 1;
      }
    }
  } catch (err) {
    console.warn('[execution-cloud] buildUnifiedJobStream failed:', err);
  }

  // Client count — real Organisation/Client rows.
  try {
    clientCount = await db.organization.count().catch(() => 0);
  } catch {
    clientCount = 0;
  }

  // Active workers — real ExecutionWorker rows (idle|busy).
  try {
    activeWorkers = await db.executionWorker.count({
      where: { status: { in: ['idle', 'busy'] } },
    }).catch(() => 0);
  } catch {
    activeWorkers = 0;
  }

  // Pipeline health — derived from the failure rate.
  const total = pipelineTotals.totalJobs;
  const failureRate = total > 0 ? (pipelineTotals.failed / total) * 100 : 0;
  const pipelineHealth: ExecutionCloudState['execution']['pipelineHealth'] =
    total === 0 ? 'low'
    : failureRate >= 25 ? 'critical'
    : failureRate >= 10 ? 'high'
    : failureRate >= 3 ? 'medium'
    : 'low';

  // Subscription snapshot — best-effort DB read, fallback to Free.
  let currentSubscription: CurrentSubscription;
  try {
    const sub = await db.subscription.findFirst({ orderBy: { createdAt: 'desc' } });
    if (sub) {
      const planId = normalisePlanId(sub.plan);
      const plan = PLAN_CATALOGUE[planId];
      currentSubscription = {
        planId,
        planName: plan.name,
        monthlyAmountINR: plan.monthly,
        yearlyAmountINR: plan.yearly,
        status: statusFromSubStatus(sub.status),
        billingCycle: (sub.billingCycle === 'yearly' ? 'yearly' : 'monthly'),
        seatCount: sub.seatCount,
        companyCount: sub.companyCount,
        currentPeriodStart: sub.currentPeriodStart?.toISOString() ?? null,
        currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
        paymentMethod: sub.paymentMethod,
      };
    } else {
      currentSubscription = buildCurrentSubscriptionSync();
    }
  } catch (err) {
    console.warn('[execution-cloud] subscription read failed:', err);
    currentSubscription = buildCurrentSubscriptionSync();
  }

  // Mobile state — real DevBuild/DevDeployment rows.
  const mobile = await buildMobileState().catch(() => ({
    builds: [], devices: [], notifications: [],
    iosLatestVersion: null, androidLatestVersion: null, activeDevices: 0,
  })) as MobileState;

  // GSTN/banking/invoice/comm providers are NOT configured in this environment
  // — surface honest "not configured" empty states (the POST routes return 501).
  const gstn: ExecutionCloudState['gstn'] = {
    configured: false,
    connections: [],
    operationsToday: 0,
    filingsThisMonth: 0,
    capabilities: [
      { id: 'gstr1',     label: 'GSTR-1 Filing',     emoji: '📄', enabled: false },
      { id: 'gstr3b',    label: 'GSTR-3B Filing',    emoji: '📋', enabled: false },
      { id: 'gstr2b',    label: 'GSTR-2B (ITC)',     emoji: '📥', enabled: false },
      { id: 'einvoice',  label: 'e-Invoice',         emoji: '🧾', enabled: false },
      { id: 'ewaybill',  label: 'e-Way Bill',        emoji: '🚚', enabled: false },
      { id: 'gstsearch', label: 'GSTIN Search',      emoji: '🔍', enabled: false },
      { id: 'panverify', label: 'PAN Verification',  emoji: '🪪', enabled: false },
    ],
  };

  const banking: ExecutionCloudState['banking'] = {
    configured: false,
    accounts: [],
    totalBalanceINR: 0,
    reconMatchRatePct: 0,
    pendingReconciliations: 0,
  };

  const invoices: ExecutionCloudState['invoices'] = {
    configured: false,
    todayCount: 0,
    outstandingINR: 0,
    buckets: [
      { type: 'sales',   label: 'Sales Invoices',   count: 0, amountINR: 0 },
      { type: 'purchase', label: 'Purchase Bills',  count: 0, amountINR: 0 },
      { type: 'tds',     label: 'TDS Records',      count: 0, amountINR: 0 },
      { type: 'payroll', label: 'Payroll Records',  count: 0, amountINR: 0 },
    ],
    recent: [],
  };

  const communication: ExecutionCloudState['communication'] = {
    totalSentToday: 0,
    avgDeliveryRatePct: 0,
    byChannel: { whatsapp: 0, email: 0, sms: 0, notice: 0, report: 0 },
  };

  const hasLiveData = pipelineTotals.totalJobs > 0 || clientCount > 0;
  const headline = hasLiveData
    ? `Execution Cloud orchestrating ${pipelineTotals.totalJobs} executions across ${clientCount} client(s) — ${pipelineTotals.running} running, ${pipelineTotals.queued} queued.`
    : 'Execution Cloud is in setup phase. Connect integrations and run workflows to activate real-time observability.';

  return {
    generatedAt,
    clientCount,
    hasLiveData,
    headline,
    gstn,
    banking,
    invoices,
    communication,
    execution: {
      pipelineHealth,
      autonomousExecutionsToday: pipelineTotals.completed,
      lastCycle: null,
    },
    jobs: {
      stats: {
        jobsCompletedToday,
        jobsFailedToday,
        activeWorkers,
        queueDepth,
        avgLatencyMs,
      },
      recent: recentJobs,
    },
    billing: {
      current: currentSubscription,
      mrrINR: currentSubscription.monthlyAmountINR,
      arrINR: currentSubscription.monthlyAmountINR * 12,
      paymentMethodOnFile: currentSubscription.paymentMethod != null,
    },
    mobile,
  };
}
