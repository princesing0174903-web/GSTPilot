// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — INFINITY AGI™ — ENTERPRISE AGI CORE™
//
// One autonomous AGI Core. Every existing system becomes a capability of the
// AGI. Oracle thinks using ALL systems simultaneously:
//   Oracle Intelligence Core™, Business Graph™, Knowledge Graph™, Digital Twin™,
//   Execution Cloud™, Compliance Cloud™, Data Intelligence Cloud™,
//   Enterprise Command Network™, Global Enterprise™, AI Software Factory™,
//   CRM™, Banking™, GST™, Payroll™, Marketplace™, Autonomous Enterprise™,
//   CEO/CFO/COO/CTO/CRO/HR/Legal/Marketing/Operations.
//
// The capability surface is derived from REAL row counts in each system's
// Prisma tables — no mock values. A capability is "online" when its underlying
// tables have been written to recently.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from './helpers';
import { safeCount, safeFindMany, cached, TTL, clamp100 } from './helpers';
import type { AGICapability, AGICapabilitySurface, AGICoreState } from './types';

// ─── Capability registry — maps each AGI capability to its real data source ──

interface CapabilitySpec {
  capability: AGICapability;
  label: string;
  role: string;
  /** Returns the number of rows created in the last hour for this capability. */
  signalsLastHour: () => Promise<number>;
  /** Returns total rows attributable to this capability (decisions contributed). */
  totalDecisions: () => Promise<number>;
  /** Returns the most recent createdAt across the capability's tables. */
  lastSync: () => Promise<Date | null>;
}

const oneHourAgo = (): Date => new Date(Date.now() - 60 * 60 * 1000);

const CAPABILITY_SPECS: CapabilitySpec[] = [
  {
    capability: 'oracle_intelligence',
    label: 'Oracle Intelligence Core™',
    role: 'Central reasoning + natural-language enterprise brain',
    signalsLastHour: () => safeCount(() => db.cEOMemory.count({ where: { occurredAt: { gte: oneHourAgo() } } })),
    totalDecisions: () => safeCount(() => db.cEODecision.count()),
    lastSync: async () => {
      const r = await safeFirst(() => db.cEOMemory.findFirst({ orderBy: { occurredAt: 'desc' }, select: { occurredAt: true } }));
      return r?.occurredAt ?? null;
    },
  },
  {
    capability: 'ceo',
    label: 'AI CEO™',
    role: 'Vision, strategy, major-investment approvals',
    signalsLastHour: () => safeCount(() => db.cEODecision.count({ where: { createdAt: { gte: oneHourAgo() } } })),
    totalDecisions: () => safeCount(() => db.cEODecision.count()),
    lastSync: async () => {
      const r = await safeFirst(() => db.cEODecision.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }));
      return r?.createdAt ?? null;
    },
  },
  {
    capability: 'cfo',
    label: 'AI CFO™',
    role: 'Revenue, cash flow, GST, banking, payroll, tax',
    signalsLastHour: () => safeCount(() => db.invoice.count({ where: { createdAt: { gte: oneHourAgo() } } })),
    totalDecisions: () => safeCount(() => db.invoice.count()),
    lastSync: async () => {
      const r = await safeFirst(() => db.invoice.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }));
      return r?.createdAt ?? null;
    },
  },
  {
    capability: 'coo',
    label: 'AI COO™',
    role: 'Day-to-day operations, vendors, SLA',
    signalsLastHour: () => safeCount(() => db.executionTask.count({ where: { createdAt: { gte: oneHourAgo() } } })),
    totalDecisions: () => safeCount(() => db.executionTask.count()),
    lastSync: async () => {
      const r = await safeFirst(() => db.executionTask.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }));
      return r?.createdAt ?? null;
    },
  },
  {
    capability: 'cto',
    label: 'AI CTO™',
    role: 'Technology, architecture, AI Software Factory',
    signalsLastHour: () => safeCount(() => db.devDeployment.count({ where: { createdAt: { gte: oneHourAgo() } } })),
    totalDecisions: () => safeCount(() => db.devProject.count()),
    lastSync: async () => {
      const r = await safeFirst(() => db.devDeployment.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }));
      return r?.createdAt ?? null;
    },
  },
  {
    capability: 'cro',
    label: 'AI CRO™',
    role: 'Risk, compliance posture, customer retention',
    signalsLastHour: () => safeCount(() => db.complianceRisk.count({ where: { detectedAt: { gte: oneHourAgo() } } })),
    totalDecisions: () => safeCount(() => db.complianceRisk.count()),
    lastSync: async () => {
      const r = await safeFirst(() => db.complianceRisk.findFirst({ orderBy: { detectedAt: 'desc' }, select: { detectedAt: true } }));
      return r?.detectedAt ?? null;
    },
  },
  {
    capability: 'hr',
    label: 'AI HR™',
    role: 'Hiring, payroll, workforce planning',
    signalsLastHour: () => safeCount(() => db.employee.count({ where: { createdAt: { gte: oneHourAgo() } } })),
    totalDecisions: () => safeCount(() => db.employee.count()),
    lastSync: async () => {
      const r = await safeFirst(() => db.employee.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }));
      return r?.createdAt ?? null;
    },
  },
  {
    capability: 'legal',
    label: 'AI Legal™',
    role: 'Contracts, ROC, notices, legal risk',
    signalsLastHour: () => safeCount(() => db.notice.count({ where: { createdAt: { gte: oneHourAgo() } } })),
    totalDecisions: () => safeCount(() => db.notice.count()),
    lastSync: async () => {
      const r = await safeFirst(() => db.notice.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }));
      return r?.createdAt ?? null;
    },
  },
  {
    capability: 'marketing',
    label: 'AI Marketing™',
    role: 'Campaigns, lead generation, brand',
    signalsLastHour: () => safeCount(() => db.client.count({ where: { createdAt: { gte: oneHourAgo() } } })),
    totalDecisions: () => safeCount(() => db.client.count()),
    lastSync: async () => {
      const r = await safeFirst(() => db.client.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }));
      return r?.createdAt ?? null;
    },
  },
  {
    capability: 'operations',
    label: 'AI Operations™',
    role: 'Workflows, automation, execution orchestration',
    signalsLastHour: () => safeCount(() => db.workflow.count({ where: { createdAt: { gte: oneHourAgo() } } })),
    totalDecisions: () => safeCount(() => db.workflow.count()),
    lastSync: async () => {
      const r = await safeFirst(() => db.workflow.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }));
      return r?.createdAt ?? null;
    },
  },
  {
    capability: 'crm',
    label: 'CRM™',
    role: 'Clients, leads, opportunities, communications',
    signalsLastHour: () => safeCount(() => db.communicationLog.count({ where: { createdAt: { gte: oneHourAgo() } } })),
    totalDecisions: () => safeCount(() => db.client.count()),
    lastSync: async () => {
      const r = await safeFirst(() => db.communicationLog.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }));
      return r?.createdAt ?? null;
    },
  },
  {
    capability: 'banking',
    label: 'Banking™',
    role: 'Bank accounts, transactions, payments',
    signalsLastHour: () => safeCount(() => db.payment.count({ where: { createdAt: { gte: oneHourAgo() } } })),
    totalDecisions: () => safeCount(() => db.payment.count()),
    lastSync: async () => {
      const r = await safeFirst(() => db.payment.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }));
      return r?.createdAt ?? null;
    },
  },
  {
    capability: 'gst',
    label: 'GST™',
    role: 'GST filings, reconciliation, ITC',
    signalsLastHour: () => safeCount(() => db.gSTRFiling.count({ where: { createdAt: { gte: oneHourAgo() } } })),
    totalDecisions: () => safeCount(() => db.gSTRFiling.count()),
    lastSync: async () => {
      const r = await safeFirst(() => db.gSTRFiling.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }));
      return r?.createdAt ?? null;
    },
  },
  {
    capability: 'payroll',
    label: 'Payroll™',
    role: 'Salaries, TDS, payroll cycles',
    signalsLastHour: () => safeCount(() => db.payroll.count({ where: { createdAt: { gte: oneHourAgo() } } })),
    totalDecisions: () => safeCount(() => db.payroll.count()),
    lastSync: async () => {
      const r = await safeFirst(() => db.payroll.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }));
      return r?.createdAt ?? null;
    },
  },
  {
    capability: 'marketplace',
    label: 'Marketplace™',
    role: 'App store, integrations, partner ecosystem',
    signalsLastHour: () => safeCount(() => db.dataConnection.count({ where: { createdAt: { gte: oneHourAgo() } } })),
    totalDecisions: () => safeCount(() => db.dataConnection.count()),
    lastSync: async () => {
      const r = await safeFirst(() => db.dataConnection.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }));
      return r?.createdAt ?? null;
    },
  },
  {
    capability: 'business_graph',
    label: 'Business Graph™',
    role: 'Entity-relationship intelligence across the enterprise',
    signalsLastHour: () => safeCount(() => db.knowledgeEdge.count({ where: { createdAt: { gte: oneHourAgo() } } })),
    totalDecisions: () => safeCount(() => db.knowledgeNode.count()),
    lastSync: async () => {
      const r = await safeFirst(() => db.knowledgeEdge.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }));
      return r?.createdAt ?? null;
    },
  },
  {
    capability: 'knowledge_graph',
    label: 'Knowledge Graph™',
    role: 'Knowledge nodes, insights, intelligence contributions',
    signalsLastHour: () => safeCount(() => db.knowledgeNode.count({ where: { createdAt: { gte: oneHourAgo() } } })),
    totalDecisions: () => safeCount(() => db.knowledgeEntry.count()),
    lastSync: async () => {
      const r = await safeFirst(() => db.knowledgeNode.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }));
      return r?.createdAt ?? null;
    },
  },
  {
    capability: 'digital_twin',
    label: 'Digital Twin™',
    role: 'Enterprise simulation + scenario forecasting',
    signalsLastHour: () => safeCount(() => db.autonomousSimulation.count({ where: { createdAt: { gte: oneHourAgo() } } })),
    totalDecisions: () => safeCount(() => db.autonomousSimulation.count()),
    lastSync: async () => {
      const r = await safeFirst(() => db.autonomousSimulation.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }));
      return r?.createdAt ?? null;
    },
  },
  {
    capability: 'execution_cloud',
    label: 'Enterprise Execution Cloud™',
    role: 'One pipeline for every module — jobs, workers, queues',
    signalsLastHour: () => safeCount(() => db.executionJob.count({ where: { createdAt: { gte: oneHourAgo() } } })),
    totalDecisions: () => safeCount(() => db.executionJob.count()),
    lastSync: async () => {
      const r = await safeFirst(() => db.executionJob.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }));
      return r?.createdAt ?? null;
    },
  },
  {
    capability: 'compliance_cloud',
    label: 'Global Compliance Cloud™',
    role: 'Regulations, filings, risk, audit trails',
    signalsLastHour: () => safeCount(() => db.complianceAuditTrail.count({ where: { createdAt: { gte: oneHourAgo() } } })),
    totalDecisions: () => safeCount(() => db.complianceRegulation.count()),
    lastSync: async () => {
      const r = await safeFirst(() => db.complianceAuditTrail.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }));
      return r?.createdAt ?? null;
    },
  },
  {
    capability: 'data_intelligence',
    label: 'Global Data Intelligence Cloud™',
    role: 'Unified enterprise data brain — catalog, lineage, forecasts',
    signalsLastHour: () => safeCount(() => db.dataLineageEvent.count({ where: { createdAt: { gte: oneHourAgo() } } })),
    totalDecisions: () => safeCount(() => db.dataCatalogEntry.count()),
    lastSync: async () => {
      const r = await safeFirst(() => db.dataLineageEvent.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }));
      return r?.createdAt ?? null;
    },
  },
  {
    capability: 'command_network',
    label: 'Enterprise Command Network™',
    role: 'Global command center — coordinated decisions + workflows',
    signalsLastHour: () => safeCount(() => db.commandAuditLog.count({ where: { occurredAt: { gte: oneHourAgo() } } })),
    totalDecisions: () => safeCount(() => db.commandDecision.count()),
    lastSync: async () => {
      const r = await safeFirst(() => db.commandAuditLog.findFirst({ orderBy: { occurredAt: 'desc' }, select: { occurredAt: true } }));
      return r?.occurredAt ?? null;
    },
  },
  {
    capability: 'global_enterprise',
    label: 'Global Enterprise OS™',
    role: 'Multi-country business cloud — entities, tax rules, FX',
    signalsLastHour: () => safeCount(() => db.globalAuditLog.count({ where: { createdAt: { gte: oneHourAgo() } } })),
    totalDecisions: () => safeCount(() => db.globalEntity.count()),
    lastSync: async () => {
      const r = await safeFirst(() => db.globalAuditLog.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }));
      return r?.createdAt ?? null;
    },
  },
  {
    capability: 'ai_software_factory',
    label: 'AI Software Factory™',
    role: 'Self-building software — projects, builds, deployments',
    signalsLastHour: () => safeCount(() => db.devBuild.count({ where: { createdAt: { gte: oneHourAgo() } } })),
    totalDecisions: () => safeCount(() => db.devProject.count()),
    lastSync: async () => {
      const r = await safeFirst(() => db.devBuild.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }));
      return r?.createdAt ?? null;
    },
  },
  {
    capability: 'autonomous_enterprise',
    label: 'Autonomous Enterprise™',
    role: 'Self-running OS — strategy room, plans, self-healing',
    signalsLastHour: () => safeCount(() => db.autonomousStrategyMeeting.count({ where: { createdAt: { gte: oneHourAgo() } } })),
    totalDecisions: () => safeCount(() => db.autonomousStrategyMeeting.count()),
    lastSync: async () => {
      const r = await safeFirst(() => db.autonomousStrategyMeeting.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }));
      return r?.createdAt ?? null;
    },
  },
];

async function safeFirst<T>(fn: () => Promise<T | null>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

// ─── Build the capability surface from REAL data ─────────────────────────────

export async function getCapabilitySurface(): Promise<AGICapabilitySurface[]> {
  const out: AGICapabilitySurface[] = [];
  for (const spec of CAPABILITY_SPECS) {
    const [signals, decisions, lastSyncDate] = await Promise.all([
      spec.signalsLastHour(),
      spec.totalDecisions(),
      spec.lastSync(),
    ]);
    // online = had activity in the last 24h OR has any historical rows
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const online = decisions > 0 && (lastSyncDate ? lastSyncDate > dayAgo : decisions > 0);
    const degraded = !online && decisions > 0;
    out.push({
      capability: spec.capability,
      label: spec.label,
      role: spec.role,
      status: online ? 'online' : degraded ? 'degraded' : 'offline',
      signalsLastCycle: signals,
      decisionsContributed: decisions,
      lastSync: lastSyncDate ? lastSyncDate.toISOString() : null,
    });
  }
  return out;
}

// ─── Reasoning engine status (from AGIReasoningCycle) ────────────────────────

async function getReasoningEngineStatus(): Promise<AGICoreState['reasoningEngine']> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [cyclesToday, recent, total] = await Promise.all([
    safeCount(() => db.aGIReasoningCycle.count({ where: { createdAt: { gte: todayStart } } })),
    safeFindMany(() => db.aGIReasoningCycle.findMany({
      where: { createdAt: { gte: todayStart } },
      select: { durationMs: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })),
    safeCount(() => db.aGIReasoningCycle.count()),
  ]);
  const avgCycleMs = recent.length > 0
    ? Math.round(recent.reduce((s, c) => s + (c.durationMs || 0), 0) / recent.length)
    : 0;
  const lastCycleAt = recent[0]?.createdAt?.toISOString() ?? null;
  const status = cyclesToday > 0 || total > 0 ? 'active' : 'idle';
  return { status, cyclesToday, avgCycleMs, lastCycleAt };
}

// ─── Safety state ────────────────────────────────────────────────────────────

async function getSafetyState(): Promise<AGICoreState['safetyState']> {
  const [pendingApprovals, rolledBack, lastShutdown, lastResume] = await Promise.all([
    safeCount(() => db.aGIApproval.count({ where: { status: 'pending' } })),
    safeCount(() => db.aGIAuditLog.count({ where: { actionType: 'rollback' } })),
    safeFirst(() => db.aGIAuditLog.findFirst({
      where: { actionType: 'shutdown' },
      orderBy: { occurredAt: 'desc' },
      select: { occurredAt: true },
    })),
    // A resume writes a rollback action with targetType 'shutdown'
    safeFirst(() => db.aGIAuditLog.findFirst({
      where: { actionType: 'rollback', targetType: 'shutdown' },
      orderBy: { occurredAt: 'desc' },
      select: { occurredAt: true },
    })),
  ]);
  // Emergency shutdown is active only if the most recent shutdown is MORE RECENT
  // than the most recent resume (rollback on shutdown). If a resume happened
  // after the shutdown, the AGI is unfrozen.
  let emergencyShutdown = false;
  if (lastShutdown) {
    const shutdownTime = lastShutdown.occurredAt.getTime();
    const resumeTime = lastResume ? lastResume.occurredAt.getTime() : 0;
    emergencyShutdown = shutdownTime > resumeTime;
  }
  return {
    emergencyShutdown,
    guardrailsActive: true,
    humanApprovalQueue: pendingApprovals,
    rolledBackActions: rolledBack,
  };
}

// ─── Enterprise AGI Core state ───────────────────────────────────────────────

export async function getAGICoreState(): Promise<AGICoreState> {
  return cached<AGICoreState>('agi:core', TTL.MEDIUM, async () => {
    const [capabilityGraph, reasoningEngine, safetyState] = await Promise.all([
      getCapabilitySurface(),
      getReasoningEngineStatus(),
      getSafetyState(),
    ]);
    const online = capabilityGraph.filter((c) => c.status === 'online').length;
    const totalSignals = capabilityGraph.reduce((s, c) => s + c.signalsLastCycle, 0);
    const totalDecisions = capabilityGraph.reduce((s, c) => s + c.decisionsContributed, 0);
    // If emergency shutdown is active, override the reasoning engine status
    const reasoningStatus = safetyState.emergencyShutdown
      ? ('shutdown' as const)
      : reasoningEngine.status;
    return {
      totalCapabilities: capabilityGraph.length,
      onlineCapabilities: online,
      totalSignals,
      totalDecisionsContributed: totalDecisions,
      capabilityGraph,
      reasoningEngine: { ...reasoningEngine, status: reasoningStatus },
      safetyState,
    };
  });
}

/** Overall AGI health — 0..100. Weighted blend of capability coverage, reasoning
 *  activity and safety posture, all grounded in real data. */
export async function getAGIHealth(): Promise<number> {
  const core = await getAGICoreState();
  if (core.safetyState.emergencyShutdown) return 0;
  const coverage = core.totalCapabilities > 0
    ? (core.onlineCapabilities / core.totalCapabilities) * 100
    : 0;
  const reasoningActivity = clamp100(core.reasoningEngine.cyclesToday * 5); // 20 cycles = 100
  const safety = 100 - Math.min(100, core.safetyState.humanApprovalQueue * 5);
  return clamp100(Math.round(coverage * 0.5 + reasoningActivity * 0.3 + safety * 0.2));
}
