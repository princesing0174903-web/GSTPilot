// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AUTONOMOUS ENTERPRISE™ — LEARNING ENGINE
//
// Every execution improves future decisions. Learns from successes, failures,
// revenue, collections, customer behaviour, vendor behaviour, employees,
// approvals and rejected actions. Oracle becomes smarter every day.
//
// Distils learnings from REAL UserBehaviour records + CEODecision outcomes +
// ExecutionTask results.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { LearningInsight } from './types';

export async function loadLearnings(): Promise<LearningInsight[]> {
  const insights: LearningInsight[] = [];

  // 1. From UserBehaviour (real learned preferences)
  try {
    const behaviours = await db.userBehaviour.findMany({
      orderBy: { evidence: 'desc' },
      take: 12,
    });
    for (const b of behaviours) {
      insights.push({
        category: b.action,
        insight: `${b.action} → ${b.preference}`,
        evidence: b.evidence,
        confidence: b.confidence,
        impact: `Applied to ${b.action} decisions`,
        appliedTo: b.action,
      });
    }
  } catch (err) {
    console.warn('[Autonomous] loadLearnings behaviours failed:', err);
  }

  // 2. From CEODecision outcomes (real success/failure rates)
  try {
    const decisions = await db.cEODecision.groupBy({
      by: ['status'],
      _count: { status: true },
    });
    const total = decisions.reduce((s, d) => s + d._count.status, 0);
    const executed = decisions.find((d) => d.status === 'executed')?._count.status ?? 0;
    const failed = decisions.find((d) => d.status === 'failed')?._count.status ?? 0;
    const rejected = decisions.find((d) => d.status === 'rejected')?._count.status ?? 0;
    if (total > 0) {
      if (executed > 0) {
        insights.push({
          category: 'execution_outcome',
          insight: `${executed} of ${total} decisions executed successfully (${Math.round((executed / total) * 100)}% execution rate)`,
          evidence: executed,
          confidence: Math.min(0.95, 0.5 + executed / total),
          impact: 'Auto-approval threshold can be relaxed for low-risk types',
          appliedTo: 'auto_approval_policy',
        });
      }
      if (failed > 0) {
        insights.push({
          category: 'execution_outcome',
          insight: `${failed} decisions failed execution — review rollback patterns`,
          evidence: failed,
          confidence: 0.6,
          impact: 'Tighten pre-flight checks for affected decision types',
          appliedTo: 'pre_flight_validation',
        });
      }
      if (rejected > 0) {
        insights.push({
          category: 'approval_pattern',
          insight: `${rejected} decisions rejected by humans — learn preference signals`,
          evidence: rejected,
          confidence: 0.55,
          impact: 'Adjust proposed action templates to match approved patterns',
          appliedTo: 'proposal_generation',
        });
      }
    }
  } catch (err) {
    console.warn('[Autonomous] loadLearnings decisions failed:', err);
  }

  // 3. From ExecutionTask agent performance
  try {
    const tasks = await db.executionTask.groupBy({
      by: ['agent'],
      _count: { agent: true },
      where: { status: 'completed' },
    });
    for (const t of tasks) {
      insights.push({
        category: 'agent_performance',
        insight: `${t.agent} completed ${t._count.agent} tasks`,
        evidence: t._count.agent,
        confidence: 0.7,
        impact: `Route more ${t.agent} work autonomously`,
        appliedTo: 'task_routing',
      });
    }
  } catch (err) {
    console.warn('[Autonomous] loadLearnings tasks failed:', err);
  }

  // Sort by confidence × evidence
  return insights
    .sort((a, b) => b.confidence * b.evidence - a.confidence * a.evidence)
    .slice(0, 15);
}
