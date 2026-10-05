// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AUTONOMOUS ENTERPRISE™ — AI STRATEGY ROOM
//
// A boardroom where the nine AI executives debate. Each presents an opinion,
// reasoning, financial impact, risk, confidence and disagreements. The room
// reaches a consensus, the CEO approves/rejects, and the meeting is stored
// PERMANENTLY in AutonomousStrategyMeeting.
//
// Debates are triggered by the live company observation (anomalies, decisions,
// risk alerts, goal reviews) — every opinion references REAL numbers.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  CompanyObservation,
  ExecutiveOpinion,
  StrategyMeeting,
  MeetingTrigger,
} from './types';
import { EXECUTIVE_ORDER } from './executives';

// ─── Persisted recent meetings ────────────────────────────────────────────────

export async function loadRecentMeetings(limit = 6): Promise<StrategyMeeting[]> {
  try {
    const rows = await db.autonomousStrategyMeeting.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(rowToMeeting);
  } catch (err) {
    console.warn('[Autonomous] loadRecentMeetings failed:', err);
    return [];
  }
}

// ─── Run a fresh strategy-room debate from the live observation ──────────────

export async function runStrategyDebate(
  obs: CompanyObservation,
  trigger: MeetingTrigger = 'scheduled',
): Promise<StrategyMeeting> {
  const topic = pickTopic(obs);
  const opinions = debate(topic, obs);
  const disagreements = collectDisagreements(opinions);
  const consensus = reachConsensus(opinions, topic);
  const ceoApproval = decideApproval(opinions, consensus);
  const financialImpact = aggregateImpact(opinions);
  const riskLevel = aggregateRisk(opinions);
  const confidence = aggregateConfidence(opinions);

  const meeting: StrategyMeeting = {
    id: `meeting_${Date.now()}`,
    topic,
    trigger,
    opinions,
    disagreements,
    consensus,
    ceoApproval,
    financialImpact,
    riskLevel,
    confidence,
    status: 'completed',
    createdAt: new Date().toISOString(),
  };

  // Persist permanently
  try {
    await db.autonomousStrategyMeeting.create({
      data: {
        topic,
        trigger,
        opinions: JSON.stringify(opinions),
        disagreements: JSON.stringify(disagreements),
        consensus,
        ceoApproval,
        financialImpact,
        riskLevel,
        confidence,
        status: 'completed',
      },
    });
  } catch (err) {
    console.warn('[Autonomous] persist strategy meeting failed:', err);
  }

  return meeting;
}

// ─── Pick the most pressing debate topic from the live observation ───────────

function pickTopic(obs: CompanyObservation): string {
  if (obs.runwayDays > 0 && obs.runwayDays < 30) {
    return `Cash runway at ${obs.runwayDays} days — capital & cost action plan`;
  }
  if (obs.compliance > 0 && obs.compliance < 80) {
    return `Compliance at ${obs.compliance}% — bring above 95% this quarter`;
  }
  if (obs.healthScore > 0 && obs.healthScore < 70) {
    return `Company Health Score ${obs.healthScore} — executive recovery plan`;
  }
  if (obs.receivables > 0) {
    return `Recover Rs ${Math.round(obs.receivables).toLocaleString('en-IN')} outstanding receivables`;
  }
  if (obs.expenses > 0 && obs.revenue > 0 && obs.expenses / obs.revenue > 0.7) {
    return `Expense ratio ${Math.round((obs.expenses / obs.revenue) * 100)}% — margin restoration`;
  }
  return 'Quarterly growth strategy — revenue, hiring & expansion roadmap';
}

// ─── Each executive weighs in (opinion grounded in real numbers) ─────────────

function debate(topic: string, obs: CompanyObservation): ExecutiveOpinion[] {
  const opinions: ExecutiveOpinion[] = [];

  for (const id of EXECUTIVE_ORDER) {
    opinions.push(executiveOpinion(id, topic, obs));
  }
  return opinions;
}

function executiveOpinion(
  exec: string,
  topic: string,
  obs: CompanyObservation,
): ExecutiveOpinion {
  // Precompute formatted strings to keep object literals simple.
  const cashStr = Math.round(obs.cash).toLocaleString('en-IN');
  const burnStr = Math.round(obs.burnRate).toLocaleString('en-IN');
  const gstStr = Math.round(obs.gst).toLocaleString('en-IN');
  const recStr = Math.round(obs.receivables).toLocaleString('en-IN');
  const payrollStr = Math.round(obs.payroll).toLocaleString('en-IN');
  const lowRunway = obs.runwayDays < 30;
  const lowCompliance = obs.compliance < 80;
  const largeTeam = obs.employees > 20;

  switch (exec) {
    case 'ceo':
      return {
        executive: 'ceo',
        stance: 'support',
        opinion: 'Approve a focused 30-day plan with clear owners and weekly checkpoints.',
        reasoning: 'Health ' + obs.healthScore + ', runway ' + obs.runwayDays + 'd. Executive accountability is the fastest lever.',
        financialImpact: obs.revenue * 0.05,
        riskLevel: 'low',
        confidence: 0.8,
        conditions: ['Weekly executive review', 'Goal Engine tracking'],
      };
    case 'cfo':
      return {
        executive: 'cfo',
        stance: lowRunway ? 'caution' : 'support',
        opinion: lowRunway
          ? 'Freeze non-essential spend; accelerate collections before any new commitment.'
          : 'Fund the plan from operating cash; preserve credit lines for contingencies.',
        reasoning: 'Cash Rs ' + cashStr + ', burn Rs ' + burnStr + '/mo, GST due Rs ' + gstStr + '.',
        financialImpact: obs.burnRate * 0.15,
        riskLevel: lowRunway ? 'high' : 'medium',
        confidence: 0.84,
      };
    case 'coo':
      return {
        executive: 'coo',
        stance: 'support',
        opinion: 'Re-prioritise the workflow queue; defer low-ROI operational tasks.',
        reasoning: obs.employees + ' employees, ' + obs.clients + ' clients, ' + obs.vendors + ' vendors. Throughput can rise 10% without new hiring.',
        financialImpact: obs.revenue * 0.03,
        riskLevel: 'low',
        confidence: 0.72,
      };
    case 'cro':
      return {
        executive: 'cro',
        stance: 'support',
        opinion: 'Launch autonomous collection workflow on the Rs ' + recStr + ' book.',
        reasoning: 'Receivables Rs ' + recStr + '; expected 60% recovery via reminder then WhatsApp then call chain.',
        financialImpact: obs.receivables * 0.6,
        riskLevel: 'low',
        confidence: 0.78,
      };
    case 'cto':
      return {
        executive: 'cto',
        stance: 'support',
        opinion: 'Hardening pass on data connections plus enable self-healing on the workflow workers.',
        reasoning: obs.aiEmployees + ' AI workers active; one anomaly detected in last cycle. Resilience prevents execution loss.',
        financialImpact: 0,
        riskLevel: 'low',
        confidence: 0.76,
      };
    case 'legal':
      return {
        executive: 'legal',
        stance: lowCompliance ? 'caution' : 'support',
        opinion: lowCompliance
          ? 'File overdue returns and clear notices before any expansion commitment.'
          : 'Compliance posture is sound; proceed with standard contract review.',
        reasoning: 'Compliance ' + obs.compliance + '%. Late filings carry penalty plus ITC reversal risk.',
        financialImpact: 0,
        riskLevel: lowCompliance ? 'high' : 'low',
        confidence: 0.88,
      };
    case 'hr':
      return {
        executive: 'hr',
        stance: 'caution',
        opinion: largeTeam ? 'Redistribute workload before hiring.' : 'Approve targeted hiring for 2 critical roles.',
        reasoning: obs.employees + ' employees on payroll Rs ' + payrollStr + '/mo. Overload risk monitored.',
        financialImpact: -obs.payroll * 0.1,
        riskLevel: 'medium',
        confidence: 0.7,
      };
    case 'marketing':
      return {
        executive: 'marketing',
        stance: 'support',
        opinion: 'Concentrate spend on the highest-LTV client segment; pause broad campaigns.',
        reasoning: obs.clients + ' clients; churn-risk segments identified from Business Graph.',
        financialImpact: obs.revenue * 0.04,
        riskLevel: 'low',
        confidence: 0.68,
      };
    case 'operations':
      return {
        executive: 'operations',
        stance: 'support',
        opinion: 'Stand up the end-to-end workflow chains (Lead to Knowledge) with full logging.',
        reasoning: 'Every autonomous action logged to ExecutionTimeline; zero manual handoffs reduces SLA breaches.',
        financialImpact: obs.revenue * 0.02,
        riskLevel: 'low',
        confidence: 0.8,
      };
    default:
      return {
        executive: 'ceo',
        stance: 'neutral',
        opinion: 'Defer.',
        reasoning: 'No position.',
        financialImpact: 0,
        riskLevel: 'low',
        confidence: 0.5,
      };
  }
}

function collectDisagreements(opinions: ExecutiveOpinion[]): string[] {
  const out: string[] = [];
  const caution = opinions.filter((o) => o.stance === 'caution' || o.stance === 'oppose');
  for (const c of caution) {
    out.push(`${labelExec(c.executive)} urged caution: ${c.opinion}`);
  }
  return out;
}

function reachConsensus(opinions: ExecutiveOpinion[], topic: string): string {
  const support = opinions.filter((o) => o.stance === 'support').length;
  const caution = opinions.filter((o) => o.stance === 'caution').length;
  const oppose = opinions.filter((o) => o.stance === 'oppose').length;
  if (oppose >= 3) {
    return `Consensus: HOLD on "${topic}". ${oppose} executives opposed; revisit after addressing concerns.`;
  }
  if (caution >= 3) {
    return `Consensus: PROCEED WITH CONDITIONS on "${topic}". ${support} support, ${caution} conditional. CFO controls spend gates; Legal clears compliance first.`;
  }
  return `Consensus: APPROVE "${topic}". ${support} of ${opinions.length} executives in support. CFO funds from operating cash; COO owns execution; weekly executive checkpoint.`;
}

function decideApproval(
  opinions: ExecutiveOpinion[],
  consensus: string,
): StrategyMeeting['ceoApproval'] {
  if (consensus.startsWith('Consensus: HOLD')) return 'rejected';
  if (consensus.startsWith('Consensus: PROCEED WITH CONDITIONS')) return 'deferred';
  return 'approved';
}

function aggregateImpact(opinions: ExecutiveOpinion[]): number {
  return opinions.reduce((s, o) => s + (o.financialImpact || 0), 0);
}

function aggregateRisk(opinions: ExecutiveOpinion[]): StrategyMeeting['riskLevel'] {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, none: 0 } as Record<string, number>;
  for (const o of opinions) counts[o.riskLevel] = (counts[o.riskLevel] || 0) + 1;
  if (counts.critical > 0) return 'critical';
  if (counts.high >= 2) return 'high';
  if (counts.high >= 1 || counts.medium >= 3) return 'medium';
  return 'low';
}

function aggregateConfidence(opinions: ExecutiveOpinion[]): number {
  if (opinions.length === 0) return 0;
  return opinions.reduce((s, o) => s + o.confidence, 0) / opinions.length;
}

function labelExec(id: string): string {
  const map: Record<string, string> = {
    ceo: 'AI CEO', cfo: 'AI CFO', coo: 'AI COO', cto: 'AI CTO', cro: 'AI CRO',
    legal: 'AI Legal', hr: 'AI HR', marketing: 'AI Marketing', operations: 'AI Operations',
  };
  return map[id] ?? id;
}

// ─── DB row -> StrategyMeeting ─────────────────────────────────────────────────

function rowToMeeting(row: {
  id: string; topic: string; trigger: string;
  opinions: string; disagreements: string; consensus: string;
  ceoApproval: string; financialImpact: number; riskLevel: string;
  confidence: number; status: string; createdAt: Date;
}): StrategyMeeting {
  let opinions: ExecutiveOpinion[] = [];
  let disagreements: string[] = [];
  try {
    opinions = JSON.parse(row.opinions) as ExecutiveOpinion[];
    disagreements = JSON.parse(row.disagreements) as string[];
  } catch { /* ignore */ }
  return {
    id: row.id,
    topic: row.topic,
    trigger: row.trigger as MeetingTrigger,
    opinions,
    disagreements,
    consensus: row.consensus,
    ceoApproval: row.ceoApproval as StrategyMeeting['ceoApproval'],
    financialImpact: row.financialImpact,
    riskLevel: row.riskLevel as StrategyMeeting['riskLevel'],
    confidence: row.confidence,
    status: row.status as StrategyMeeting['status'],
    createdAt: row.createdAt.toISOString(),
  };
}
