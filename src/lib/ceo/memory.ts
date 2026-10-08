// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI CEO™ — CEO MEMORY™
//
// Oracle's long-term business memory. Pulls from:
//   • Digital Twin timeline events (most recent 20)
//   • CFO AI recommendations
//   • Digital Twin anomalies
//
// Each memory is classified into one of:
//   decision, strategy, milestone, board_meeting, market_change,
//   growth_event, risk_event, learning
//
// Memories carry:
//   • Importance  — 0-1 (higher = more memorable)
//   • OccurredAt  — ISO timestamp
//   • Tags        — searchable keywords
//
// Capped at 15 memories, sorted by importance desc. No fabrication — every
// memory ties back to a real business event.
//
// Tagline: VEYRO AI CEO™ — Run Your Business. Not Your Software.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  CEOMemory,
  MemoryType,
} from './types';
import type { CEODataView } from './data';
import { formatINR } from './data';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let counter = 0;
function makeId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

function importanceFromSeverity(severity: 'info' | 'low' | 'medium' | 'high' | 'critical'): number {
  const map = { info: 0.2, low: 0.35, medium: 0.55, high: 0.75, critical: 0.95 };
  return map[severity] ?? 0.3;
}

// ─── Timeline event → Memory mapping ─────────────────────────────────────────

const TIMELINE_TO_MEMORY: Record<string, MemoryType> = {
  invoice_created: 'growth_event',
  invoice_paid: 'milestone',
  gst_filed: 'milestone',
  gst_updated: 'milestone',
  bank_synced: 'learning',
  expense_added: 'learning',
  employee_added: 'growth_event',
  payroll_processed: 'milestone',
  whatsapp_received: 'learning',
  email_received: 'learning',
  task_completed: 'milestone',
  collection_received: 'milestone',
  vendor_updated: 'learning',
  oracle_action: 'decision',
  notice_received: 'risk_event',
  report_generated: 'board_meeting',
  payment_made: 'milestone',
  purchase_added: 'learning',
  reconciliation_done: 'milestone',
  return_prepared: 'milestone',
  health_changed: 'market_change',
  risk_changed: 'risk_event',
  cash_changed: 'market_change',
  client_added: 'growth_event',
  connection_synced: 'milestone',
  decision_simulated: 'decision',
  anomaly_detected: 'risk_event',
  snapshot_created: 'board_meeting',
  other: 'learning',
};

function memoryFromTimeline(event: {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  source: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  actor?: string;
  entityId?: string;
  entityType?: string;
  amount?: number;
  metadata?: Record<string, unknown>;
}): CEOMemory | null {
  const memoryType = TIMELINE_TO_MEMORY[event.type] ?? 'learning';
  const importance = importanceFromSeverity(event.severity);

  // Boost importance for high-value events
  let boostedImportance = importance;
  if (event.amount && event.amount > 100000) boostedImportance = Math.min(0.99, importance + 0.1);
  if (event.amount && event.amount > 1000000) boostedImportance = Math.min(0.99, importance + 0.2);

  const tags = [
    event.source,
    event.type,
    event.entityType,
    event.actor,
  ].filter((t): t is string => Boolean(t));

  return {
    id: makeId('mem-tl'),
    memoryType,
    title: event.title,
    description: event.description || event.title,
    importance: Math.round(boostedImportance * 100) / 100,
    occurredAt: event.timestamp,
    tags,
    metadata: {
      source: 'timeline',
      eventId: event.id,
      amount: event.amount,
      ...event.metadata,
    },
  };
}

// ─── CFO Recommendation → Memory (decision memory) ───────────────────────────

function memoryFromRecommendation(rec: {
  id: string;
  title: string;
  reason: string;
  financialImpact: string;
  financialImpactValue: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  timeframe: string;
}, generatedAt: string): CEOMemory {
  const importanceMap = { critical: 0.9, high: 0.75, medium: 0.55, low: 0.35 };
  const importance = importanceMap[rec.priority] ?? 0.5;

  return {
    id: makeId('mem-rec'),
    memoryType: 'decision',
    title: `CFO Recommendation: ${rec.title}`,
    description: `${rec.reason} Financial impact: ${rec.financialImpact}. Timeframe: ${rec.timeframe}.`,
    importance: Math.round(importance * 100) / 100,
    occurredAt: generatedAt,
    tags: ['cfo', 'recommendation', rec.category, rec.priority, rec.timeframe],
    metadata: {
      source: 'cfo_recommendations',
      recommendationId: rec.id,
      financialImpactValue: rec.financialImpactValue,
    },
  };
}

// ─── Anomaly → Memory (risk event) ───────────────────────────────────────────

function memoryFromAnomaly(anom: {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  detectedAt: string;
  metric: string;
  currentValue: number;
  expectedValue: number;
  deviationPct: number;
  recommendation: string;
}): CEOMemory {
  const importance = importanceFromSeverity(anom.severity);

  return {
    id: makeId('mem-anom'),
    memoryType: 'risk_event',
    title: `Anomaly: ${anom.title}`,
    description: `${anom.description} Metric: ${anom.metric}, expected ${anom.expectedValue}, actual ${anom.currentValue} (${anom.deviationPct.toFixed(1)}% deviation). Action: ${anom.recommendation}`,
    importance: Math.round(importance * 100) / 100,
    occurredAt: anom.detectedAt,
    tags: ['anomaly', anom.type, anom.severity, anom.metric],
    metadata: {
      source: 'digital_twin_anomaly',
      anomalyId: anom.id,
      deviationPct: anom.deviationPct,
    },
  };
}

// ─── Synthetic milestone memories (derived from live data) ───────────────────

function buildMilestoneMemories(data: CEODataView): CEOMemory[] {
  const memories: CEOMemory[] = [];
  const live = data.liveState;
  const cfo = data.cfo;

  // Milestone: revenue threshold crossings
  if (live.revenue >= 10000000) {
    memories.push({
      id: makeId('mem-milestone'),
      memoryType: 'milestone',
      title: 'Monthly revenue crossed ₹1 Cr',
      description: `Business hit ${formatINR(live.revenue)} in monthly revenue — crossing the ₹1 Cr MRR milestone.`,
      importance: 0.95,
      occurredAt: new Date().toISOString(),
      tags: ['milestone', 'revenue', 'crore'],
      metadata: { source: 'milestone_tracker', metric: 'revenue', value: live.revenue },
    });
  } else if (live.revenue >= 100000) {
    memories.push({
      id: makeId('mem-milestone'),
      memoryType: 'milestone',
      title: 'Monthly revenue crossed ₹1 L',
      description: `Business hit ${formatINR(live.revenue)} in monthly revenue — crossing the ₹1 L MRR milestone.`,
      importance: 0.7,
      occurredAt: new Date().toISOString(),
      tags: ['milestone', 'revenue', 'lakh'],
      metadata: { source: 'milestone_tracker', metric: 'revenue', value: live.revenue },
    });
  }

  // Milestone: client count threshold
  if (live.clients >= 100) {
    memories.push({
      id: makeId('mem-milestone'),
      memoryType: 'milestone',
      title: `Crossed ${live.clients} active clients`,
      description: `Active client base reached ${live.clients}.`,
      importance: 0.85,
      occurredAt: new Date().toISOString(),
      tags: ['milestone', 'clients', 'growth'],
      metadata: { source: 'milestone_tracker', metric: 'clients', value: live.clients },
    });
  } else if (live.clients >= 10) {
    memories.push({
      id: makeId('mem-milestone'),
      memoryType: 'milestone',
      title: `Crossed ${live.clients} active clients`,
      description: `Active client base reached ${live.clients}.`,
      importance: 0.6,
      occurredAt: new Date().toISOString(),
      tags: ['milestone', 'clients', 'growth'],
      metadata: { source: 'milestone_tracker', metric: 'clients', value: live.clients },
    });
  }

  // Market change: MoM growth
  if (Math.abs(cfo.revenue.growthPct) > 10) {
    memories.push({
      id: makeId('mem-market'),
      memoryType: 'market_change',
      title: `Revenue ${cfo.revenue.growthPct >= 0 ? 'up' : 'down'} ${Math.abs(cfo.revenue.growthPct).toFixed(1)}% MoM`,
      description: `Month-over-month revenue ${cfo.revenue.growthPct >= 0 ? 'growth' : 'decline'} of ${Math.abs(cfo.revenue.growthPct).toFixed(1)}%. Current MTD: ${formatINR(live.revenue)}.`,
      importance: cfo.revenue.growthPct < 0 ? 0.85 : 0.7,
      occurredAt: new Date().toISOString(),
      tags: ['market_change', 'mom', cfo.revenue.growthPct >= 0 ? 'growth' : 'decline'],
      metadata: { source: 'revenue_engine', momPct: cfo.revenue.growthPct },
    });
  }

  // Risk event: critical risk from CFO
  const criticalRisk = cfo.risks.risks.find((r) => r.severity === 'critical');
  if (criticalRisk) {
    memories.push({
      id: makeId('mem-risk'),
      memoryType: 'risk_event',
      title: `Critical risk: ${criticalRisk.label}`,
      description: `${criticalRisk.impact} Current: ${criticalRisk.current}. Threshold: ${criticalRisk.threshold}.`,
      importance: 0.95,
      occurredAt: new Date().toISOString(),
      tags: ['risk', 'critical', criticalRisk.type],
      metadata: { source: 'cfo_risk_engine', riskType: criticalRisk.type, score: criticalRisk.score },
    });
  }

  return memories;
}

// ─── Board-meeting memory (latest snapshot) ──────────────────────────────────

function buildBoardMeetingMemory(data: CEODataView): CEOMemory | null {
  // Use the latest monthly snapshot as the "last board meeting" stand-in
  const monthlySnapshots = data.twin.snapshots.monthly;
  const latest = monthlySnapshots[monthlySnapshots.length - 1];
  if (!latest) return null;

  return {
    id: makeId('mem-board'),
    memoryType: 'board_meeting',
    title: `Board snapshot — ${latest.periodLabel}`,
    description: `Period ${latest.periodLabel}: revenue ${formatINR(latest.revenue)}, profit ${formatINR(latest.profit)}, cash ${formatINR(latest.cash)}, health ${latest.healthScore}/100, risk ${latest.riskScore}/100.`,
    importance: 0.8,
    occurredAt: latest.periodEnd,
    tags: ['board_meeting', 'snapshot', 'monthly', latest.periodLabel],
    metadata: {
      source: 'digital_twin_snapshot',
      frequency: 'monthly',
      periodLabel: latest.periodLabel,
      revenue: latest.revenue,
      profit: latest.profit,
      cash: latest.cash,
      healthScore: latest.healthScore,
    },
  };
}

// ─── Learning memories (derived from client payment patterns) ────────────────

function buildLearningMemories(data: CEODataView): CEOMemory[] {
  const memories: CEOMemory[] = [];

  // Learning: average days-to-pay from collection engine
  const avgDaysToPay = data.cfo.collections.averageDaysToPay;
  if (avgDaysToPay > 0) {
    const tier = avgDaysToPay <= 30 ? 'fast payers' : avgDaysToPay <= 60 ? 'standard payers' : 'slow payers';
    memories.push({
      id: makeId('mem-learn'),
      memoryType: 'learning',
      title: `Client payment pattern: ${tier} (avg ${avgDaysToPay}d)`,
      description: `Across all clients, the average days-to-pay is ${avgDaysToPay} days. Clients are classified as ${tier}. Use this to set realistic cash-flow expectations.`,
      importance: 0.55,
      occurredAt: new Date().toISOString(),
      tags: ['learning', 'payment_pattern', 'collections'],
      metadata: { source: 'collection_engine', avgDaysToPay, tier },
    });
  }

  // Learning: top client concentration insight
  const topClient = data.cfo.revenue.byClient[0];
  if (topClient && topClient.sharePct > 25) {
    memories.push({
      id: makeId('mem-learn'),
      memoryType: 'learning',
      title: `${topClient.clientName} is ${topClient.sharePct.toFixed(1)}% of revenue`,
      description: `${topClient.clientName} contributes ${formatINR(topClient.revenue)} (${topClient.sharePct.toFixed(1)}% of total revenue). High concentration risk — diversification is a strategic priority.`,
      importance: 0.7,
      occurredAt: new Date().toISOString(),
      tags: ['learning', 'concentration', 'top_client'],
      metadata: {
        source: 'revenue_engine',
        clientId: topClient.clientId,
        sharePct: topClient.sharePct,
      },
    });
  }

  return memories;
}

// ─── Main entry: compute CEO memory ──────────────────────────────────────────

export function computeCEOMemory(data: CEODataView): CEOMemory[] {
  const memories: CEOMemory[] = [];

  // 1. Timeline events — most recent 20
  try {
    const events = [...data.twin.timeline.events]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);
    for (const ev of events) {
      const m = memoryFromTimeline(ev);
      if (m) memories.push(m);
    }
  } catch (err) {
    console.warn('[AI CEO Memory] Timeline conversion failed:', err);
  }

  // 2. CFO recommendations → decision memories
  try {
    for (const rec of data.cfo.recommendations.recommendations) {
      memories.push(memoryFromRecommendation(rec, data.cfo.recommendations.generatedAt));
    }
  } catch (err) {
    console.warn('[AI CEO Memory] Recommendations conversion failed:', err);
  }

  // 3. Anomalies → risk-event memories
  try {
    for (const anom of data.twin.anomalies.anomalies) {
      memories.push(memoryFromAnomaly(anom));
    }
  } catch (err) {
    console.warn('[AI CEO Memory] Anomaly conversion failed:', err);
  }

  // 4. Synthetic milestone / market-change / learning memories
  try {
    for (const m of buildMilestoneMemories(data)) memories.push(m);
  } catch (err) {
    console.warn('[AI CEO Memory] Milestone builder failed:', err);
  }

  // 5. Board-meeting memory (latest snapshot)
  try {
    const board = buildBoardMeetingMemory(data);
    if (board) memories.push(board);
  } catch (err) {
    console.warn('[AI CEO Memory] Board snapshot builder failed:', err);
  }

  // 6. Learning memories
  try {
    for (const m of buildLearningMemories(data)) memories.push(m);
  } catch (err) {
    console.warn('[AI CEO Memory] Learning builder failed:', err);
  }

  // Sort by importance (desc), then by recency (most recent first)
  return memories
    .sort((a, b) => {
      if (b.importance !== a.importance) return b.importance - a.importance;
      return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
    })
    .slice(0, 15);
}
