// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — INFINITY AGI™ — CONTINUOUS AUTONOMOUS REASONING™
//
// Oracle reasons continuously — not only when asked. Every few minutes Oracle
// automatically: monitors enterprise health, evaluates opportunities, evaluates
// risks, predicts failures, finds growth, plans actions, prioritizes work.
//
// Each cycle grounds its observation in the REAL company state (AI CFO Phase 1
// + Digital Twin + raw Prisma rows) via fetchCEOData, then derives conclusions
// and proposed actions from that observation. The reasoning chain is persisted
// to AGIReasoningCycle for full auditability and replay.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from './helpers';
import { cached, TTL, clamp01, clamp100, safeCount, parseJson, emptyBreakdown } from './helpers';
import { fetchCEOData } from '@/lib/ceo/data';
import { getCommandDashboard } from '@/lib/command-network';
import type {
  ReasoningCycle, ReasoningSummary, ReasoningObservation, ReasoningTrigger,
  ReasoningFocus, AGIConclusion,
} from './types';

const TRIGGERS: ReasoningTrigger[] = ['scheduled', 'anomaly', 'goal_review', 'incident', 'opportunity', 'human'];
const FOCUSES: ReasoningFocus[] = ['health', 'opportunity', 'risk', 'failure', 'growth', 'planning', 'prioritization'];

// ─── Build the live enterprise observation ───────────────────────────────────

export async function buildObservation(): Promise<ReasoningObservation> {
  return cached<ReasoningObservation>('agi:observation', TTL.SHORT, async () => {
    const ceoData = await fetchCEOData().catch(() => null);
    const cmd = await getCommandDashboard().catch(() => null);
    const live = ceoData?.liveState;
    const twin = ceoData?.twin;

    const cash = live?.cash ?? 0;
    const revenue = live?.revenue ?? 0;
    const compliance = twin?.state?.compliance ?? 0;
    const runway = live?.runwayDays ?? 0;

    // open incidents + active goals + pending decisions from command network
    const openIncidents = cmd?.incidents?.recent?.filter(
      (i) => i.status !== 'resolved' && i.status !== 'closed',
    ).length ?? 0;
    const activeWorkflows = cmd?.globalOperations?.activeWorkflows ?? 0;
    const pendingDecisions = cmd?.decisions?.summary?.pendingReview ?? 0;

    // active goals
    const activeGoals = await safeCount(() => db.aGIGoal.count({ where: { status: 'active' } }));

    // active agents (swarm)
    const activeAgents = await safeCount(() => db.aGIAgent.count({ where: { status: 'active' } }));

    // top risks from CFO risks engine
    const topRisks: string[] = [];
    const risks = ceoData?.cfo?.risks;
    if (risks) {
      if (risks.criticalCount > 0) topRisks.push(`${risks.criticalCount} critical financial risks`);
      if (risks.highCount > 0) topRisks.push(`${risks.highCount} high-severity risks`);
      const liqRisk = risks.risks?.find((r) => r.type === 'liquidity_risk');
      if (liqRisk && liqRisk.severity !== 'low') topRisks.push(`Liquidity risk: ${liqRisk.severity}`);
      const itcAtRisk = ceoData?.cfo?.gst?.itcAtRisk ?? 0;
      if (itcAtRisk > 0) topRisks.push(`ITC at risk ₹${Math.round(itcAtRisk).toLocaleString('en-IN')}`);
    }
    if (runway > 0 && runway < 90) topRisks.push(`Cash runway only ${runway} days`);

    // top opportunities
    const topOpportunities: string[] = [];
    const collections = ceoData?.cfo?.collections;
    if (collections && collections.expectedCollections30d > 0) {
      topOpportunities.push(`₹${Math.round(collections.expectedCollections30d).toLocaleString('en-IN')} expected collections in 30d`);
    }
    if (live && live.forecastRevenue30d > 0) {
      topOpportunities.push(`Forecasted revenue ₹${Math.round(live.forecastRevenue30d).toLocaleString('en-IN')} next 30 days`);
    }
    if (revenue > 0) {
      topOpportunities.push(`Revenue run-rate ₹${Math.round(revenue * 12).toLocaleString('en-IN')}/yr`);
    }

    // organization health = blend of compliance, execution, system health
    const executionHealth = cmd?.executionHealth ?? 0;
    const systemHealth = cmd?.systemHealth ?? 0;
    const organizationHealth = clamp100(
      Math.round((compliance + executionHealth + systemHealth) / 3),
    );

    return {
      organizationHealth,
      cashPositionINR: cash,
      revenueMTD: revenue,
      complianceScore: compliance,
      openIncidents,
      activeGoals,
      pendingDecisions,
      activeAgents,
      runwayDays: runway,
      topRisks: topRisks.slice(0, 5),
      topOpportunities: topOpportunities.slice(0, 5),
      evaluatedAt: new Date().toISOString(),
    };
  });
}

// ─── Derive conclusions from the observation ─────────────────────────────────

/**
 * Deterministic reasoning over the live observation. Each focus produces zero
 * or more conclusions with supporting evidence + proposed actions. No LLM call
 * — this is the auditable, replayable reasoning core that grounds every cycle
 * in the same REAL data.
 */
export function deriveConclusions(obs: ReasoningObservation): AGIConclusion[] {
  const out: AGIConclusion[] = [];

  // ── HEALTH focus ──
  if (obs.organizationHealth < 50) {
    out.push({
      focus: 'health',
      finding: `Organization health is ${obs.organizationHealth}%, below the 70% healthy threshold.`,
      supportingEvidence: [
        `Compliance score ${obs.complianceScore}%`,
        `Open incidents: ${obs.openIncidents}`,
        `Pending decisions: ${obs.pendingDecisions}`,
      ],
      proposedActions: [
        'Triage open incidents via the Enterprise Command Network',
        'Expedite pending executive decisions',
        'Trigger the Incident Response playbook for critical items',
      ],
      confidence: clamp01(0.6 + (50 - obs.organizationHealth) / 200),
      urgency: obs.organizationHealth < 30 ? 'critical' : 'high',
    });
  } else {
    out.push({
      focus: 'health',
      finding: `Organization health is stable at ${obs.organizationHealth}%.`,
      supportingEvidence: [
        `Compliance score ${obs.complianceScore}%`,
        `Open incidents: ${obs.openIncidents}`,
      ],
      proposedActions: ['Continue scheduled reasoning cadence'],
      confidence: 0.7,
      urgency: 'low',
    });
  }

  // ── RISK focus ──
  if (obs.runwayDays > 0 && obs.runwayDays < 90) {
    out.push({
      focus: 'risk',
      finding: `Cash runway is ${obs.runwayDays} days — below the 90-day safety buffer.`,
      supportingEvidence: [
        `Cash position ₹${Math.round(obs.cashPositionINR).toLocaleString('en-IN')}`,
        `Revenue MTD ₹${Math.round(obs.revenueMTD).toLocaleString('en-IN')}`,
      ],
      proposedActions: [
        'Launch the Cash Crisis Response workflow',
        'Freeze non-essential spend above ₹50,000',
        'Accelerate collections on overdue invoices',
        'Request CFO review of upcoming payroll cycle',
      ],
      confidence: 0.85,
      urgency: obs.runwayDays < 30 ? 'critical' : 'high',
    });
  }
  for (const risk of obs.topRisks) {
    if (risk.includes('Liquidity')) {
      out.push({
        focus: 'risk',
        finding: risk,
        supportingEvidence: [risk],
        proposedActions: ['Increase cash reserves', 'Negotiate supplier payment terms'],
        confidence: 0.7,
        urgency: 'high',
      });
    }
    if (risk.includes('ITC')) {
      out.push({
        focus: 'risk',
        finding: risk,
        supportingEvidence: [risk],
        proposedActions: ['Reconcile purchase registers', 'File timely GSTR-2B reconciliation'],
        confidence: 0.75,
        urgency: 'medium',
      });
    }
  }

  // ── FAILURE focus (predict failures) ──
  if (obs.pendingDecisions > 5) {
    out.push({
      focus: 'failure',
      finding: `${obs.pendingDecisions} decisions are pending review — risk of decision backlog stalling execution.`,
      supportingEvidence: [`Pending decisions: ${obs.pendingDecisions}`],
      proposedActions: [
        'Auto-route aged decisions to the CEO Agent for escalation',
        'Apply the Decision Acceleration automation rule',
      ],
      confidence: 0.65,
      urgency: 'medium',
    });
  }
  if (obs.openIncidents > 3) {
    out.push({
      focus: 'failure',
      finding: `${obs.openIncidents} open incidents — risk of cascading operational failures.`,
      supportingEvidence: [`Open incidents: ${obs.openIncidents}`],
      proposedActions: ['Trigger Incident Response playbook', 'Assign CRO Agent as incident commander'],
      confidence: 0.7,
      urgency: 'high',
    });
  }

  // ── OPPORTUNITY focus ──
  for (const opp of obs.topOpportunities) {
    if (opp.includes('expected collections')) {
      out.push({
        focus: 'opportunity',
        finding: opp,
        supportingEvidence: [opp],
        proposedActions: ['Send proactive collection reminders', 'Offer early-payment discounts to top debtors'],
        confidence: 0.7,
        urgency: 'medium',
      });
    }
    if (opp.includes('Forecasted revenue')) {
      out.push({
        focus: 'opportunity',
        finding: opp,
        supportingEvidence: [opp],
        proposedActions: ['Align marketing spend with forecasted demand', 'Pre-position inventory'],
        confidence: 0.65,
        urgency: 'low',
      });
    }
  }

  // ── GROWTH focus ──
  if (obs.revenueMTD > 0) {
    out.push({
      focus: 'growth',
      finding: `Revenue run-rate supports growth investment evaluation.`,
      supportingEvidence: [`Revenue MTD ₹${Math.round(obs.revenueMTD).toLocaleString('en-IN')}`],
      proposedActions: [
        'Simulate a 10% pricing increase via the Organizational Digital Twin',
        'Evaluate expansion to a new geography',
      ],
      confidence: 0.6,
      urgency: 'low',
    });
  }

  // ── PLANNING focus ──
  if (obs.activeGoals > 0) {
    out.push({
      focus: 'planning',
      finding: `${obs.activeGoals} active goals require continuous plan monitoring.`,
      supportingEvidence: [`Active goals: ${obs.activeGoals}`],
      proposedActions: ['Run the Autonomous Project Manager cycle', 'Re-estimate timelines for at-risk plans'],
      confidence: 0.7,
      urgency: 'medium',
    });
  }

  // ── PRIORITIZATION focus ──
  out.push({
    focus: 'prioritization',
    finding: `Prioritization cycle complete — ${out.length} findings ranked by urgency.`,
    supportingEvidence: out.map((c) => `${c.focus}: ${c.urgency}`),
    proposedActions: ['Forward critical findings to the CEO Agent', 'Schedule next reasoning cycle in 5 minutes'],
    confidence: 0.6,
    urgency: 'low',
  });

  return out;
}

// ─── Run a reasoning cycle + persist ─────────────────────────────────────────

let cycleCounter = 0;

export async function runReasoningCycle(
  trigger: ReasoningTrigger = 'scheduled',
  focusHint?: ReasoningFocus,
): Promise<ReasoningCycle> {
  const startedAt = Date.now();
  const obs = await buildObservation();
  // Pick focus: explicit hint, otherwise rotate based on what the observation surfaces
  const focus: ReasoningFocus = focusHint ?? pickFocus(obs);
  const conclusions = deriveConclusions(obs).filter((c) => focusHint ? c.focus === focus : true);
  if (conclusions.length === 0) {
    // ensure at least one conclusion for the chosen focus
    conclusions.push(...deriveConclusions(obs));
  }

  const reasoningChain = buildReasoningChain(obs, focus, conclusions);
  const actionsProposed = conclusions.reduce((s, c) => s + c.proposedActions.length, 0);
  const confidence = conclusions.length > 0
    ? clamp01(conclusions.reduce((s, c) => s + c.confidence, 0) / conclusions.length)
    : 0.5;
  const durationMs = Date.now() - startedAt;

  // monotonic cycle number
  const lastCycle = await safeFirst();
  cycleCounter = Math.max(cycleCounter, (lastCycle ?? 0) + 1);

  // Persist the cycle
  let created;
  try {
    created = await db.aGIReasoningCycle.create({
      data: {
        cycleNumber: cycleCounter,
        trigger,
        focus,
        observation: JSON.stringify(obs),
        reasoning: reasoningChain,
        conclusions: JSON.stringify(conclusions),
        actionsProposed,
        actionsApproved: 0,
        actionsExecuted: 0,
        confidence,
        durationMs,
        status: 'completed',
        shutdownFlag: false,
      },
    });
  } catch {
    // if persist fails, still return the in-memory cycle
  }

  // Update per-conclusion focus breakdown is implicit in the row
  const cycle: ReasoningCycle = {
    id: created?.id ?? `cycle-${cycleCounter}`,
    cycleNumber: cycleCounter,
    trigger,
    focus,
    observation: obs,
    reasoning: reasoningChain,
    conclusions,
    actionsProposed,
    actionsApproved: 0,
    actionsExecuted: 0,
    confidence,
    durationMs,
    status: 'completed',
    shutdownFlag: false,
    createdAt: created?.createdAt?.toISOString() ?? new Date().toISOString(),
  };
  return cycle;

  async function safeFirst(): Promise<number | null> {
    try {
      const r = await db.aGIReasoningCycle.findFirst({
        orderBy: { cycleNumber: 'desc' },
        select: { cycleNumber: true },
      });
      return r?.cycleNumber ?? 0;
    } catch {
      return 0;
    }
  }
}

function pickFocus(obs: ReasoningObservation): ReasoningFocus {
  if (obs.organizationHealth < 50) return 'health';
  if (obs.runwayDays > 0 && obs.runwayDays < 90) return 'risk';
  if (obs.openIncidents > 3) return 'failure';
  if (obs.topOpportunities.length > 0) return 'opportunity';
  if (obs.activeGoals > 0) return 'planning';
  return 'prioritization';
}

function buildReasoningChain(obs: ReasoningObservation, focus: ReasoningFocus, conclusions: AGIConclusion[]): string {
  const lines: string[] = [];
  lines.push(`# Reasoning Cycle — Focus: ${focus.toUpperCase()}`);
  lines.push(`Evaluated at ${obs.evaluatedAt}.`);
  lines.push('');
  lines.push('## Enterprise Observation');
  lines.push(`- Organization health: ${obs.organizationHealth}%`);
  lines.push(`- Cash position: ₹${Math.round(obs.cashPositionINR).toLocaleString('en-IN')}`);
  lines.push(`- Revenue MTD: ₹${Math.round(obs.revenueMTD).toLocaleString('en-IN')}`);
  lines.push(`- Compliance score: ${obs.complianceScore}%`);
  lines.push(`- Open incidents: ${obs.openIncidents}`);
  lines.push(`- Active goals: ${obs.activeGoals}`);
  lines.push(`- Pending decisions: ${obs.pendingDecisions}`);
  lines.push(`- Active agents: ${obs.activeAgents}`);
  lines.push(`- Runway days: ${obs.runwayDays}`);
  if (obs.topRisks.length) {
    lines.push(`- Top risks: ${obs.topRisks.join('; ')}`);
  }
  if (obs.topOpportunities.length) {
    lines.push(`- Top opportunities: ${obs.topOpportunities.join('; ')}`);
  }
  lines.push('');
  lines.push('## Reasoning');
  lines.push(`Given the observation, Oracle focused on ${focus}.`);
  lines.push(`Oracle derived ${conclusions.length} conclusion(s):`);
  for (const c of conclusions) {
    lines.push('');
    lines.push(`### ${c.focus} — urgency: ${c.urgency}, confidence: ${(c.confidence * 100).toFixed(0)}%`);
    lines.push(`Finding: ${c.finding}`);
    if (c.supportingEvidence.length) {
      lines.push('Evidence:');
      for (const e of c.supportingEvidence) lines.push(`  - ${e}`);
    }
    if (c.proposedActions.length) {
      lines.push('Proposed actions:');
      for (const a of c.proposedActions) lines.push(`  - ${a}`);
    }
  }
  lines.push('');
  lines.push('## Cycle Outcome');
  lines.push(`Proposed ${conclusions.reduce((s, c) => s + c.proposedActions.length, 0)} actions across ${conclusions.length} conclusions.`);
  return lines.join('\n');
}

// ─── Load recent cycles ──────────────────────────────────────────────────────

export async function getRecentCycles(limit = 12): Promise<ReasoningCycle[]> {
  const rows = await safeFindMany(() => db.aGIReasoningCycle.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  }));
  return rows.map((r) => ({
    id: r.id,
    cycleNumber: r.cycleNumber,
    trigger: r.trigger as ReasoningTrigger,
    focus: r.focus as ReasoningFocus,
    observation: parseJson<ReasoningObservation>(r.observation, emptyObservation()),
    reasoning: r.reasoning,
    conclusions: parseJson<AGIConclusion[]>(r.conclusions, []),
    actionsProposed: r.actionsProposed,
    actionsApproved: r.actionsApproved,
    actionsExecuted: r.actionsExecuted,
    confidence: r.confidence,
    durationMs: r.durationMs,
    status: r.status as ReasoningCycle['status'],
    shutdownFlag: r.shutdownFlag,
    createdAt: r.createdAt.toISOString(),
  }));
}

function emptyObservation(): ReasoningObservation {
  return {
    organizationHealth: 0, cashPositionINR: 0, revenueMTD: 0, complianceScore: 0,
    openIncidents: 0, activeGoals: 0, pendingDecisions: 0, activeAgents: 0,
    runwayDays: 0, topRisks: [], topOpportunities: [],
    evaluatedAt: new Date().toISOString(),
  };
}

async function safeFindMany<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try { return await fn(); } catch { return []; }
}

// ─── Reasoning summary ───────────────────────────────────────────────────────

export async function getReasoningSummary(): Promise<ReasoningSummary> {
  return cached<ReasoningSummary>('agi:reasoning:summary', TTL.MEDIUM, async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [total, todayRows, allRows, lastRow] = await Promise.all([
      safeCount(() => db.aGIReasoningCycle.count()),
      safeFindMany(() => db.aGIReasoningCycle.findMany({
        where: { createdAt: { gte: todayStart } },
        select: { confidence: true, durationMs: true, trigger: true, focus: true, actionsProposed: true, actionsExecuted: true },
      })),
      safeFindMany(() => db.aGIReasoningCycle.findMany({
        select: { confidence: true, durationMs: true, trigger: true, focus: true, actionsProposed: true, actionsExecuted: true },
      })),
      safeFirstRow(),
    ]);

    const triggersBreakdown = emptyBreakdown(TRIGGERS);
    const focusBreakdown = emptyBreakdown(FOCUSES);
    for (const r of allRows) {
      triggersBreakdown[r.trigger as ReasoningTrigger] = (triggersBreakdown[r.trigger as ReasoningTrigger] ?? 0) + 1;
      focusBreakdown[r.focus as ReasoningFocus] = (focusBreakdown[r.focus as ReasoningFocus] ?? 0) + 1;
    }
    const avgConfidence = allRows.length > 0
      ? clamp01(allRows.reduce((s, r) => s + (r.confidence || 0), 0) / allRows.length)
      : 0;
    const avgDurationMs = allRows.length > 0
      ? Math.round(allRows.reduce((s, r) => s + (r.durationMs || 0), 0) / allRows.length)
      : 0;
    const actionsProposed = allRows.reduce((s, r) => s + (r.actionsProposed || 0), 0);
    const actionsExecuted = allRows.reduce((s, r) => s + (r.actionsExecuted || 0), 0);
    const executionRate = actionsProposed > 0 ? actionsExecuted / actionsProposed : 0;

    // Emergency shutdown = most recent shutdown is more recent than the most recent resume
    let emergencyShutdownActive = false;
    try {
      const [shutdown, resume] = await Promise.all([
        db.aGIAuditLog.findFirst({
          where: { actionType: 'shutdown' },
          orderBy: { occurredAt: 'desc' },
          select: { occurredAt: true },
        }),
        db.aGIAuditLog.findFirst({
          where: { actionType: 'rollback', targetType: 'shutdown' },
          orderBy: { occurredAt: 'desc' },
          select: { occurredAt: true },
        }),
      ]);
      if (shutdown) {
        const shutdownTime = shutdown.occurredAt.getTime();
        const resumeTime = resume ? resume.occurredAt.getTime() : 0;
        emergencyShutdownActive = shutdownTime > resumeTime;
      }
    } catch { /* ignore */ }

    return {
      totalCycles: total,
      cyclesToday: todayRows.length,
      avgConfidence,
      avgDurationMs,
      lastCycleAt: lastRow?.createdAt?.toISOString() ?? null,
      triggersBreakdown,
      focusBreakdown,
      actionsProposed,
      actionsExecuted,
      executionRate: clamp01(executionRate),
      emergencyShutdownActive,
    };
  });

  async function safeFirstRow() {
    try {
      return await db.aGIReasoningCycle.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
    } catch { return null; }
  }
}
