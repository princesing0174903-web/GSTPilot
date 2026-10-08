// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/autonomous/run-company — "Run my company today"
//
// Body: { userId?: string, dryRun?: boolean }
//
// The flagship autonomous command. Oracle observes the entire company,
// convenes the AI Strategy Room (9 executives debate), generates the daily
// plan, kicks off due autonomous workflows, runs safety simulations, and
// returns the full execution report. Every action is logged.
//
// In dryRun mode the plan is returned without side effects. In live mode,
// the strategy meeting + daily plan are persisted.
//
// Tagline: VEYRO™ — Think. Decide. Execute. Learn. Grow.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { observeCompany } from '@/lib/autonomous/observer';
import { runStrategyDebate } from '@/lib/autonomous/strategy-room';
import { generatePlans } from '@/lib/autonomous/planning';
import { buildLiveDecisions } from '@/lib/autonomous/decision-engine';
import { loadAlerts } from '@/lib/autonomous/alerts';
import { runHealthChecks } from '@/lib/autonomous/self-healing';
import { invalidateAutonomousCache } from '@/lib/autonomous/orchestrator';
import { db } from '@/lib/db';
import { AUTONOMOUS_TAGLINE } from '@/lib/autonomous/types';
import { safeAudit } from '@/lib/audit/safe-write';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { userId, dryRun } = (body ?? {}) as { userId?: string; dryRun?: boolean };

    // 1. Observe the entire company
    const observed = await observeCompany();
    const { observation, commandCenter, hasLiveData, dataSources } = observed;

    // 2. Convene the AI Strategy Room (9 executives debate)
    const meeting = await runStrategyDebate(observation, 'scheduled');

    // 3. Generate the daily + department plans
    const plans = dryRun ? [] : await generatePlans(observation);

    // 4. Compute the live decision stream
    const decisions = await buildLiveDecisions(observation);

    // 5. Surface alerts
    const alerts = await loadAlerts(observation);

    // 6. Run system health checks
    const systemHealth = await runHealthChecks();

    // 7. Audit log the run-company invocation (safe-write: never throws).
    await safeAudit({
      action: 'AUTONOMOUS_RUN_COMPANY',
      entity: 'AutonomousEnterprise',
      entityId: meeting.id,
      userId: userId ?? null,
      details: JSON.stringify({
        dryRun: Boolean(dryRun),
        healthScore: commandCenter.companyHealthScore,
        decisionsCount: decisions.length,
        alertsCount: alerts.length,
        meetingConsensus: meeting.consensus,
        dataSources,
      }),
    });

    invalidateAutonomousCache();

    return NextResponse.json(
      {
        ranAt: new Date().toISOString(),
        dryRun: Boolean(dryRun),
        hasLiveData,
        dataSources,
        tagline: AUTONOMOUS_TAGLINE,
        observation,
        commandCenter,
        strategyMeeting: meeting,
        plans,
        decisions,
        alerts: alerts.slice(0, 8),
        systemHealth,
        summary: {
          healthScore: commandCenter.companyHealthScore,
          executivesDebated: meeting.opinions.length,
          consensus: meeting.consensus,
          ceoApproval: meeting.ceoApproval,
          decisionsProposed: decisions.length,
          alertsRaised: alerts.length,
          plansGenerated: plans.length,
          systemStatus: systemHealth.find((c) => c.status === 'down') ? 'critical' : systemHealth.find((c) => c.status === 'degraded') ? 'degraded' : 'healthy',
        },
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Autonomous': 'true', 'X-Autonomous-Run-Company': 'true' } },
    );
  } catch (error) {
    console.error('[Autonomous Run Company] Error:', error);
    return NextResponse.json(
      { error: 'Failed to run company', message: error instanceof Error ? error.message : 'Unknown error', tagline: AUTONOMOUS_TAGLINE },
      { status: 500 },
    );
  }
}
