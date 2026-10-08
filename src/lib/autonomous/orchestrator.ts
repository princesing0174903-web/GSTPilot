// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AUTONOMOUS ENTERPRISE™ — ORCHESTRATOR
//
// Single entry point for the Executive Command Center. Pulls the live company
// observation + 9 executives + decisions + strategy room + plans + goals +
// workflows + simulations + memory stats + alerts + learnings + self-healing
// into one AutonomousDashboard. Cached 45s in-memory.
//
// Tagline: VEYRO Infinity™ — Think. Decide. Execute. Learn. Grow.
// ═══════════════════════════════════════════════════════════════════════════════

import { observeCompany } from './observer';
import { getExecutives } from './executives';
import { buildLiveDecisions } from './decision-engine';
import { loadRecentMeetings } from './strategy-room';
import { loadPlans } from './planning';
import { loadGoals } from './goals';
import { loadActiveWorkflows, WORKFLOW_TEMPLATES } from './workflows';
import { loadRecentSimulations } from './simulator';
import { getMemoryStats } from './memory';
import { loadAlerts } from './alerts';
import { loadLearnings } from './learning';
import { runHealthChecks, loadHealingEvents } from './self-healing';
import { db } from '@/lib/db';
import {
  AUTONOMOUS_TAGLINE,
  AUTONOMOUS_FOUNDER,
  type AutonomousDashboard,
  type ExecutionStats,
} from './types';

// ─── In-memory cache (45s) ────────────────────────────────────────────────────

let cached: AutonomousDashboard | null = null;
let cacheAt = 0;
const TTL_MS = 45_000;

export function invalidateAutonomousCache(): void {
  cached = null;
  cacheAt = 0;
}

export async function getAutonomousDashboard(): Promise<AutonomousDashboard> {
  if (cached && Date.now() - cacheAt < TTL_MS) {
    return cached;
  }
  cached = await buildDashboard();
  cacheAt = Date.now();
  return cached;
}

// ─── Build the full dashboard ────────────────────────────────────────────────

async function buildDashboard(): Promise<AutonomousDashboard> {
  const observed = await observeCompany();
  const { observation, commandCenter, hasLiveData, dataSources, fetchedAt } = observed;

  const [
    executives,
    decisions,
    recentMeetings,
    plans,
    goals,
    activeWorkflows,
    recentSimulations,
    memoryStats,
    alerts,
    learnings,
    systemHealth,
    recentHealingEvents,
    executionStats,
    pendingApprovals,
  ] = await Promise.all([
    getExecutives(),
    buildLiveDecisions(observation),
    loadRecentMeetings(),
    loadPlans(observation),
    loadGoals(observation),
    loadActiveWorkflows(),
    loadRecentSimulations(),
    getMemoryStats(),
    loadAlerts(observation),
    loadLearnings(),
    runHealthChecks(),
    loadHealingEvents(),
    computeExecutionStats(),
    countPendingApprovals(),
  ]);

  return {
    generatedAt: fetchedAt,
    hasLiveData,
    dataSources,
    tagline: AUTONOMOUS_TAGLINE,
    founder: AUTONOMOUS_FOUNDER,
    observation,
    commandCenter,
    executives,
    decisions,
    pendingApprovals,
    recentMeetings,
    plans,
    goals,
    activeWorkflows,
    workflowTemplates: WORKFLOW_TEMPLATES,
    recentSimulations,
    memoryStats,
    alerts,
    learnings,
    systemHealth,
    recentHealingEvents,
    executionStats,
  };
}

// ─── Execution stats (from REAL CEODecision records) ──────────────────────────

async function computeExecutionStats(): Promise<ExecutionStats> {
  try {
    const decisions = await db.cEODecision.findMany({
      select: { status: true, confidence: true, risk: true, financialImpact: true },
    });
    const total = decisions.length;
    if (total === 0) {
      return {
        totalDecisions: 0, autoExecuted: 0, approvedExecuted: 0, rejected: 0,
        pending: 0, successRate: 0, avgRiskScore: 0, avgConfidence: 0, avgROI: 0,
      };
    }
    const executed = decisions.filter((d) => d.status === 'executed').length;
    const autoExecuted = decisions.filter((d) => d.status === 'auto_approved').length;
    const rejected = decisions.filter((d) => d.status === 'rejected').length;
    const pending = decisions.filter((d) => d.status === 'pending').length;
    const successful = executed + autoExecuted;
    const riskNum = (r: string) =>
      r === 'critical' ? 90 : r === 'high' ? 70 : r === 'medium' ? 45 : r === 'low' ? 20 : 5;
    return {
      totalDecisions: total,
      autoExecuted,
      approvedExecuted: executed,
      rejected,
      pending,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      avgRiskScore: decisions.reduce((s, d) => s + riskNum(d.risk), 0) / total,
      avgConfidence: decisions.reduce((s, d) => s + (d.confidence ?? 0), 0) / total,
      avgROI: decisions.reduce((s, d) => s + (d.financialImpact ?? 0), 0) / total,
    };
  } catch (err) {
    console.warn('[Autonomous] computeExecutionStats failed:', err);
    return {
      totalDecisions: 0, autoExecuted: 0, approvedExecuted: 0, rejected: 0,
      pending: 0, successRate: 0, avgRiskScore: 0, avgConfidence: 0, avgROI: 0,
    };
  }
}

async function countPendingApprovals(): Promise<number> {
  try {
    return await db.approval.count({ where: { status: 'pending' } });
  } catch {
    return 0;
  }
}
