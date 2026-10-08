// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — INFINITY AGI™ — DASHBOARD ORCHESTRATOR
//
// Single entry point that bundles all AGI subsystems into one AGIDashboard
// for the Executive API: /api/agi/dashboard
//
// One Intelligence. Every Decision. Entire Enterprise. Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { cached, TTL, clamp100, safeCount } from './helpers';
import { db } from './helpers';
import { fetchCEOData } from '@/lib/ceo/data';
import { getCommandDashboard } from '@/lib/command-network';
import type { AGIDashboard } from './types';
import { AGI_TAGLINE, AGI_SUBTAGLINE, AGI_FOUNDER } from './types';

import { getAGICoreState, getAGIHealth } from './core';
import { getSwarmAgents, getSwarmSummary, getRecentAgentMessages, seedAgentsIfMissing } from './swarm';
import { getReasoningSummary, getRecentCycles, buildObservation } from './reasoning';
import { getMemorySummary, getRecentMemories, seedMemoriesFromRealData } from './memory';
import { getGoals, getGoalSummary, seedGoalsIfMissing, refreshGoalProgress } from './goals';
import { getPlans, getProjectManagerSummary, seedPlansFromGoals, refreshPlanProgress } from './pm';
import { getRecentLearnings, getLearningSummary, seedLearningsFromRealData } from './learning';
import { getRecentSimulations, getTwinSummary } from './twin';
import { getSecuritySummary, getRecentAudit, getPendingApprovals, getRecentDecisions } from './security';

/**
 * One-time warm-up: seed agents, goals, memories, learnings + refresh progress
 * so the dashboard has REAL rows to aggregate on first load.
 */
async function warmUpAGI(): Promise<void> {
  await cached('agi:warmup', TTL.LONG, async () => {
    await seedAgentsIfMissing().catch(() => undefined);
    await seedGoalsIfMissing().catch(() => undefined);
    await refreshGoalProgress().catch(() => undefined);
    await seedPlansFromGoals().catch(() => undefined);
    await refreshPlanProgress().catch(() => undefined);
    await seedMemoriesFromRealData().catch(() => undefined);
    await seedLearningsFromRealData().catch(() => undefined);
    return true;
  });
}

/** Build the unified Enterprise AGI Dashboard bundle. */
export async function getAGIDashboard(): Promise<AGIDashboard> {
  await warmUpAGI();

  return cached<AGIDashboard>(
    'agi:dashboard',
    TTL.MEDIUM,
    async (): Promise<AGIDashboard> => {
      // ── Pull REAL live enterprise state ────────────────────────────────────
      const ceoData = await fetchCEOData().catch(() => null);
      const cmd = await getCommandDashboard().catch(() => null);
      const live = ceoData?.liveState;
      const twin = ceoData?.twin;

      // ── Run all subsystem fetches in parallel ──────────────────────────────
      const [
        agiHealth,
        core,
        reasoningSummary,
        recentCycles,
        swarmSummary,
        swarmAgents,
        recentMessages,
        memorySummary,
        recentMemories,
        goalSummary,
        recentGoals,
        pmSummary,
        recentPlans,
        learningSummary,
        recentLearnings,
        twinSummary,
        recentSimulations,
        securitySummary,
        recentAudit,
        pendingApprovals,
        recentDecisions,
        memoryCount,
      ] = await Promise.all([
        getAGIHealth(),
        getAGICoreState(),
        getReasoningSummary(),
        getRecentCycles(12),
        getSwarmSummary(),
        getSwarmAgents(),
        getRecentAgentMessages(24),
        getMemorySummary(),
        getRecentMemories(24),
        getGoalSummary(),
        getGoals(24),
        getProjectManagerSummary(),
        getPlans(20),
        getLearningSummary(),
        getRecentLearnings(24),
        getTwinSummary(),
        getRecentSimulations(16),
        getSecuritySummary(),
        getRecentAudit(30),
        getPendingApprovals(20),
        getRecentDecisions(20),
        safeCount(() => db.aGIMemory.count()),
      ]);

      const pendingDecisions = recentDecisions.filter(
        (d) => d.status === 'proposed' || d.status === 'in_review',
      ).length;

      const organizationHealth = cmd?.organizationHealth ?? 0;

      return {
        generatedAt: new Date().toISOString(),

        // AGI Core live cards
        agiHealth: clamp100(agiHealth),
        organizationHealth,
        capabilitiesOnline: core.onlineCapabilities,
        reasoningStatus: core.reasoningEngine.status,
        cyclesToday: reasoningSummary.cyclesToday,
        activeAgents: swarmSummary.activeAgents,
        activeGoals: goalSummary.activeGoals,
        pendingApprovals: securitySummary.pendingApprovals,
        memoryEntries: memoryCount,
        learningsApplied: learningSummary.appliedOptimizations,
        simulationsRun: twinSummary.totalSimulations,
        emergencyShutdown: securitySummary.emergencyShutdownActive,

        // Subsystem bundles
        core,
        reasoning: { summary: reasoningSummary, recent: recentCycles },
        swarm: { summary: swarmSummary, agents: swarmAgents, recentMessages },
        memory: { summary: memorySummary, recent: recentMemories },
        goals: { summary: goalSummary, recent: recentGoals },
        plans: { summary: pmSummary, recent: recentPlans },
        learning: { summary: learningSummary, recent: recentLearnings },
        twin: { summary: twinSummary, recent: recentSimulations },
        decisions: { recent: recentDecisions, pending: pendingDecisions },
        security: { summary: securitySummary, recentAudit, pendingApprovals },

        // Live enterprise state (grounded in real data)
        liveState: {
          cashPositionINR: live?.cash ?? 0,
          revenueMTD: live?.revenue ?? 0,
          complianceScore: twin?.state?.compliance ?? 0,
          runwayDays: live?.runwayDays ?? 0,
          openIncidents: cmd?.globalOperations?.openIncidents ?? 0,
          activeWorkflows: cmd?.globalOperations?.activeWorkflows ?? 0,
          dataSources: ceoData?.dataSources ?? [],
        },

        tagline: AGI_TAGLINE,
        subtagline: AGI_SUBTAGLINE,
        founder: AGI_FOUNDER,
      };
    },
  );
}

/** Re-export the observation builder so the reasoning API can use it. */
export { buildObservation };
