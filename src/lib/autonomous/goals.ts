// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AUTONOMOUS ENTERPRISE™ — GOAL ENGINE
//
// Organizations create goals (increase revenue 40%, reduce GST penalties,
// reduce expenses, increase collections, improve compliance, expand into a
// new city). Oracle continuously tracks progress against the REAL live
// company observation + persisted CEOGoal records.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { ownerForDecisionType } from './executives';
import type { AutonomousGoal, CompanyObservation, ExecutiveId } from './types';

// ─── Seed canonical goals if none exist, then track against live data ────────

export async function loadGoals(obs: CompanyObservation): Promise<AutonomousGoal[]> {
  let goals;
  try {
    goals = await db.cEOGoal.findMany({ orderBy: { createdAt: 'desc' } });
  } catch (err) {
    console.warn('[Autonomous] loadGoals failed:', err);
    return [];
  }

  // If no goals yet, seed the canonical autonomous goal set from the live obs
  if (goals.length === 0) {
    return await seedGoals(obs);
  }

  // Map persisted goals → AutonomousGoal, updating `current` from live data
  return goals.map((g) => mapGoal(g, obs));
}

async function seedGoals(obs: CompanyObservation): Promise<AutonomousGoal[]> {
  const now = new Date();
  const yearEnd = new Date(now.getFullYear(), 11, 31).toISOString();
  const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0).toISOString();

  const seeds = [
    {
      category: 'revenue',
      title: 'Increase revenue 40% this year',
      description: 'Drive top-line growth via collections, new logos and pricing.',
      baseline: Math.round(obs.revenue * 12 * 0.9) || 0,
      current: Math.round(obs.revenue * 12) || 0,
      target: Math.round(obs.revenue * 12 * 1.4) || 1000000,
      unit: 'inr',
      deadline: yearEnd,
      owner: 'cro' as ExecutiveId,
      reasoning: 'Annualised current revenue × 1.4 target.',
    },
    {
      category: 'gst_compliance',
      title: 'Reduce GST penalties to zero',
      description: 'File every return on time; clear notices proactively.',
      baseline: Math.max(obs.gst, 0),
      current: Math.max(obs.gst, 0),
      target: 0,
      unit: 'inr',
      deadline: quarterEnd,
      owner: 'legal' as ExecutiveId,
      reasoning: 'Zero net GST penalty exposure this quarter.',
    },
    {
      category: 'collections',
      title: `Recover ₹${Math.round(obs.receivables).toLocaleString('en-IN')} outstanding`,
      description: 'Autonomous collection workflow on the full receivables book.',
      baseline: Math.round(obs.receivables) || 0,
      current: Math.round(obs.receivables) || 0,
      target: Math.round(obs.receivables * 0.3) || 0,
      unit: 'inr',
      deadline: quarterEnd,
      owner: 'cro' as ExecutiveId,
      reasoning: 'Reduce outstanding to 30% of baseline via AI collection chain.',
    },
    {
      category: 'customer_growth',
      title: 'Grow active clients 25%',
      description: 'Onboard new logos; reduce churn via Business Graph signals.',
      baseline: Math.round(obs.clients * 0.9) || 0,
      current: obs.clients || 0,
      target: Math.round((obs.clients || 10) * 1.25),
      unit: 'count',
      deadline: yearEnd,
      owner: 'cro' as ExecutiveId,
      reasoning: '25% net-new client growth.',
    },
    {
      category: 'market_expansion',
      title: 'Expand into 1 new city',
      description: 'Open presence in a new geography this year.',
      baseline: 0,
      current: 0,
      target: 1,
      unit: 'count',
      deadline: yearEnd,
      owner: 'ceo' as ExecutiveId,
      reasoning: 'One new city presence validated via Digital Twin Simulator 2.0.',
    },
    {
      category: 'runway',
      title: 'Maintain 90+ days cash runway',
      description: 'Preserve liquidity; optimise working capital continuously.',
      baseline: obs.runwayDays || 0,
      current: obs.runwayDays || 0,
      target: 90,
      unit: 'days',
      deadline: yearEnd,
      owner: 'cfo' as ExecutiveId,
      reasoning: 'Runway floor of 90 days protects against shocks.',
    },
  ];

  const created: AutonomousGoal[] = [];
  for (const s of seeds) {
    try {
      const row = await db.cEOGoal.create({
        data: {
          category: s.category,
          title: s.title,
          description: s.description,
          baseline: s.baseline,
          current: s.current,
          target: s.target,
          unit: s.unit,
          deadline: new Date(s.deadline),
          progressPct: computeProgressPct(s.baseline, s.current, s.target),
          status: 'on_track',
          trendPct: 0,
        },
      });
      created.push(mapGoal(row, obs));
    } catch (err) {
      console.warn('[Autonomous] seed goal failed:', err);
    }
  }
  return created;
}

function mapGoal(
  row: {
    id: string; category: string; title: string; description: string;
    baseline: number; current: number; target: number; unit: string;
    deadline: Date; progressPct: number; status: string; trendPct: number;
  },
  obs: CompanyObservation,
): AutonomousGoal {
  // Refresh `current` from live observation where applicable
  let current = row.current;
  if (row.category === 'revenue') current = obs.revenue * 12;
  else if (row.category === 'gst_compliance') current = obs.gst;
  else if (row.category === 'collections') current = obs.receivables;
  else if (row.category === 'customer_growth') current = obs.clients;
  else if (row.category === 'runway') current = obs.runwayDays;

  const progressPct = computeProgressPct(row.baseline, current, row.target);
  const status = computeStatus(progressPct, row.deadline);

  // Best-effort persist the refreshed current
  try {
    void db.cEOGoal.update({
      where: { id: row.id },
      data: { current, progressPct, status },
    });
  } catch { /* fire-and-forget */ }

  return {
    id: row.id,
    category: row.category,
    title: row.title,
    description: row.description,
    baseline: row.baseline,
    current,
    target: row.target,
    unit: row.unit,
    deadline: row.deadline.toISOString(),
    progressPct,
    status: status as AutonomousGoal['status'],
    trendPct: row.trendPct,
    owner: ownerForDecisionType(row.category === 'revenue' ? 'follow_up_lead' : row.category === 'gst_compliance' ? 'pay_gst' : row.category === 'collections' ? 'recover_payment' : 'improve_profitability'),
    reasoning: `Live ${row.category} = ${current} vs target ${row.target}.`,
  };
}

function computeProgressPct(baseline: number, current: number, target: number): number {
  const delta = target - baseline;
  if (delta === 0) return current >= target ? 100 : 0;
  // For "reduce" goals (target < baseline), invert
  const progress = ((current - baseline) / delta) * 100;
  return Math.max(0, Math.min(100, Math.round(progress)));
}

function computeStatus(progressPct: number, deadline: Date): string {
  const daysLeft = (deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (progressPct >= 100) return 'achieved';
  if (daysLeft < 0) return 'overdue';
  if (progressPct >= 60) return 'on_track';
  if (progressPct >= 30) return 'at_risk';
  return 'behind';
}
