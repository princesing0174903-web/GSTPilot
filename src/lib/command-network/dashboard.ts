// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — Enterprise Command Network™ (GLOBAL COMMAND CENTER)
// Orchestrator — single entry point that bundles all 16 subsystems into one
// CommandDashboard for the Executive API: /api/command/dashboard
//
// One Command. Every Team. Entire Enterprise. Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { cached, TTL, clamp100, safeCount } from './helpers';
import { db } from './helpers';
import { fetchCEOData } from '@/lib/ceo/data';
import type { CommandDashboard } from './types';

import { getCommandFabric, getCommandExecutives } from './engine';
import { getDecisions, getDecisionSummary } from './decisions';
import { getCrossModuleSync } from './coordination';
import { getOperationsMap } from './operations-map';
import { getWorkflows, getWorkflowSummary } from './workflows';
import { getIncidents, getIncidentSummary, detectIncidents } from './incidents';
import { getPlaybooks, getPlaybookSummary, seedPlaybooksIfMissing } from './playbooks';
import { getSimulations, getSimulationSummary } from './simulator';
import { getCommandAnalytics } from './analytics';
import { getObservabilitySignals, getObservabilitySummary, measureObservability } from './observability';
import { getCollaborationSummary } from './collaboration';
import { getAutomationSummary } from './automation';
import { getSecuritySummary } from './security';

/**
 * One-time warm-up: seed playbooks, detect incidents, measure observability so
 * the dashboard has REAL rows to aggregate.
 */
async function warmUpCommandNetwork(): Promise<void> {
  await cached('cn:warmup', TTL.LONG, async () => {
    await seedPlaybooksIfMissing().catch(() => undefined);
    await detectIncidents().catch(() => undefined);
    await measureObservability().catch(() => undefined);
    return true;
  });
}

/** Build the unified Global Command Center Dashboard bundle. */
export async function getCommandDashboard(): Promise<CommandDashboard> {
  await warmUpCommandNetwork();

  return cached<CommandDashboard>(
    'cn:dashboard',
    TTL.MEDIUM,
    async () => {
      // ── Pull REAL live enterprise state ────────────────────────────────────
      const ceoData = await fetchCEOData().catch(() => null);
      const liveState = ceoData?.liveState;
      const twin = ceoData?.twin;

      // ── Run all subsystem fetches in parallel ──────────────────────────────
      const [
        fabric,
        executives,
        decisionSummary,
        decisionsRecent,
        coordination,
        operationsMap,
        workflowSummary,
        workflowsRecent,
        incidentSummary,
        incidentsRecent,
        playbookSummary,
        playbooksRecent,
        simulationSummary,
        simulationsRecent,
        analytics,
        observabilitySummary,
        observabilityRecent,
        collaboration,
        automation,
        security,
        globalEntityCount,
        countryCount,
      ] = await Promise.all([
        getCommandFabric(),
        getCommandExecutives(),
        getDecisionSummary(),
        getDecisions(12),
        getCrossModuleSync(),
        getOperationsMap(),
        getWorkflowSummary(),
        getWorkflows(12),
        getIncidentSummary(),
        getIncidents(12),
        getPlaybookSummary(),
        getPlaybooks(),
        getSimulationSummary(),
        getSimulations(12),
        getCommandAnalytics(),
        getObservabilitySummary(),
        getObservabilitySignals(),
        getCollaborationSummary(),
        getAutomationSummary(),
        getSecuritySummary(),
        safeCount(() => db.globalEntity.count({ where: { status: 'active' } })),
        safeCount(() => db.country.count({ where: { isActive: true } })),
      ]);

      // ── Global Command Center live cards ───────────────────────────────────
      const cashPositionINR = liveState?.cash ?? 0;
      const revenueMTD = liveState?.revenue ?? 0;
      const complianceScore = twin?.state?.compliance ?? 0;
      const executionHealth = analytics.executionEfficiency;
      const systemHealth = observabilitySummary.healthScore;
      const organizationHealth = clamp100(
        Math.round(
          (executionHealth + systemHealth + complianceScore + analytics.globalPerformance) / 4,
        ),
      );

      // Critical alerts = open incidents with severity high/critical
      const criticalAlerts = incidentsRecent.filter(
        (i) => (i.severity === 'high' || i.severity === 'critical') && i.status !== 'resolved' && i.status !== 'closed',
      ).slice(0, 6);

      // Countries with entity counts + health
      const countries = operationsMap.nodes
        .filter((n) => n.type === 'country')
        .slice(0, 12)
        .map((n) => ({
          iso: n.country ?? 'XX',
          name: n.label,
          entities: n.metrics.entities ?? 0,
          health: n.healthScore,
        }));

      return {
        generatedAt: new Date().toISOString(),

        // Global Command Center™ live cards
        organizationHealth,
        globalOperations: {
          activeWorkflows: workflowSummary.activeNow,
          openIncidents: incidentSummary.openCritical + (incidentSummary.byStatus.open ?? 0),
          pendingDecisions: decisionSummary.pendingReview,
          activeExecutives: executives.filter((e) => e.status === 'active').length,
        },
        criticalAlerts,
        countries,
        legalEntities: globalEntityCount,
        cashPositionINR,
        revenueMTD,
        complianceScore,
        executionHealth,
        aiActivity: {
          activeExecutives: executives.filter((e) => e.status === 'active').length,
          decisionsToday: executives.reduce((s, e) => s + e.decisionsToday, 0),
          simulationsToday: simulationSummary.totalSimulations,
          automationsFired: automation.executionsToday,
        },
        systemHealth,

        // Subsystem bundles
        fabric,
        decisions: { summary: decisionSummary, recent: decisionsRecent },
        coordination,
        operationsMap,
        workflows: { summary: workflowSummary, recent: workflowsRecent },
        incidents: { summary: incidentSummary, recent: incidentsRecent },
        playbooks: { summary: playbookSummary, recent: playbooksRecent },
        simulations: { summary: simulationSummary, recent: simulationsRecent },
        analytics,
        observability: { summary: observabilitySummary, recent: observabilityRecent.slice(0, 16) },
        collaboration,
        automation,
        security,
        executives,
      };
    },
  );
}
