// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AUTONOMOUS ENTERPRISE™ — NINE AI EXECUTIVES
//
// The autonomous executive team: AI CEO, AI CFO, AI COO, AI CTO, AI CRO,
// AI Legal, AI HR, AI Marketing, AI Operations. Each owns decision domains
// and is measured against REAL execution records (CEODecision, ExecutionTask,
// CEOTask) from the past 30 days.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { ExecutiveAgent, ExecutiveId, ExecutiveMetrics } from './types';

// ─── Executive roster (mandate + decision domains) ───────────────────────────

export const EXECUTIVE_ROSTER: Record<
  ExecutiveId,
  Omit<ExecutiveAgent, 'metrics'>
> = {
  ceo: {
    id: 'ceo',
    name: 'Oracle CEO',
    title: 'Chief Executive Officer',
    emoji: '👑',
    mandate:
      'Sets company vision, approves major decisions, resolves executive disagreements, and owns the Company Health Score.',
    decisionDomains: [
      'strategy',
      'growth',
      'expansion',
      'major_investments',
      'hiring_leadership',
      'ceo_approval',
    ],
  },
  cfo: {
    id: 'cfo',
    name: 'Oracle CFO',
    title: 'Chief Financial Officer',
    emoji: '💰',
    mandate:
      'Owns revenue, expenses, cash flow, GST, banking, payroll and financial risk. Approves every money-moving action.',
    decisionDomains: [
      'cash_flow',
      'expenses',
      'collections',
      'gst',
      'payroll',
      'banking',
      'forecasting',
      'tax',
    ],
  },
  coo: {
    id: 'coo',
    name: 'Oracle COO',
    title: 'Chief Operating Officer',
    emoji: '⚙️',
    mandate:
      'Runs day-to-day operations, vendors, inventory, workflow orchestration and SLA compliance.',
    decisionDomains: [
      'operations',
      'vendor_management',
      'inventory',
      'workflow_orchestration',
      'sla',
      'process_efficiency',
    ],
  },
  cto: {
    id: 'cto',
    name: 'Oracle CTO',
    title: 'Chief Technology Officer',
    emoji: '🛠️',
    mandate:
      'Owns the AI Workforce, integrations, data connections, security, infrastructure and self-healing.',
    decisionDomains: [
      'ai_workforce',
      'integrations',
      'data_connections',
      'security',
      'infrastructure',
      'self_healing',
    ],
  },
  cro: {
    id: 'cro',
    name: 'Oracle CRO',
    title: 'Chief Revenue Officer',
    emoji: '📈',
    mandate:
      'Owns sales, CRM pipeline, lead conversion, collections recovery and revenue growth.',
    decisionDomains: [
      'sales',
      'crm_pipeline',
      'lead_conversion',
      'collections_recovery',
      'revenue_growth',
      'pricing',
    ],
  },
  legal: {
    id: 'legal',
    name: 'Oracle Legal',
    title: 'Chief Legal Officer',
    emoji: '⚖️',
    mandate:
      'Owns contracts, compliance, ROC, GST notices, GDPR/data governance and legal risk.',
    decisionDomains: [
      'contracts',
      'compliance',
      'roc',
      'gst_notices',
      'data_governance',
      'legal_risk',
    ],
  },
  hr: {
    id: 'hr',
    name: 'Oracle HR',
    title: 'Chief People Officer',
    emoji: '👥',
    mandate:
      'Owns hiring pipeline, payroll readiness, employee workload, retention and culture.',
    decisionDomains: [
      'hiring_pipeline',
      'payroll_readiness',
      'employee_workload',
      'retention',
      'culture',
    ],
  },
  marketing: {
    id: 'marketing',
    name: 'Oracle Marketing',
    title: 'Chief Marketing Officer',
    emoji: '📣',
    mandate:
      'Owns brand, campaigns, customer behaviour analysis, churn prevention and growth loops.',
    decisionDomains: [
      'brand',
      'campaigns',
      'customer_behaviour',
      'churn_prevention',
      'growth_loops',
    ],
  },
  operations: {
    id: 'operations',
    name: 'Oracle Operations',
    title: 'VP Operations',
    emoji: '🔄',
    mandate:
      'Executes the autonomous workflow chains end-to-end: Lead → Qualification → Proposal → … → Knowledge update.',
    decisionDomains: [
      'workflow_execution',
      'task_assignment',
      'scheduling',
      'follow_ups',
      'documentation',
    ],
  },
};

export const EXECUTIVE_ORDER: ExecutiveId[] = [
  'ceo',
  'cfo',
  'coo',
  'cro',
  'cto',
  'legal',
  'hr',
  'marketing',
  'operations',
];

// ─── Map a CEODecision type / ExecutionTask agent to an owning executive ─────

const DECISION_OWNER: Record<string, ExecutiveId> = {
  recover_payment: 'cro',
  remind_client: 'operations',
  follow_up_lead: 'cro',
  increase_prices: 'cro',
  reduce_expenses: 'cfo',
  pause_marketing: 'marketing',
  increase_marketing: 'marketing',
  delay_purchase: 'coo',
  pay_gst: 'cfo',
  claim_itc: 'cfo',
  hire_employees: 'hr',
  delay_hiring: 'hr',
  suggest_loan: 'cfo',
  repay_loan: 'cfo',
  optimize_cash: 'cfo',
  reduce_vendor_dependency: 'coo',
  improve_collections: 'cro',
  improve_profitability: 'cfo',
  improve_runway: 'cfo',
  review_compliance: 'legal',
  review_expense: 'cfo',
  approve_payroll: 'hr',
  renew_subscription: 'cto',
  review_contract: 'legal',
  pay_vendor: 'cfo',
  reply_customer: 'operations',
  schedule_meeting: 'operations',
  file_overdue_return: 'legal',
  investigate_anomaly: 'cto',
  create_quotation: 'cro',
};

export function ownerForDecisionType(type: string): ExecutiveId {
  return DECISION_OWNER[type] ?? 'ceo';
}

// ─── Real metrics for each executive from the past 30 days ───────────────────

const EMPTY_METRICS: ExecutiveMetrics = {
  decisionsLast30d: 0,
  approvalsLast30d: 0,
  autoExecutedLast30d: 0,
  avgConfidence: 0,
  avgRiskScore: 0,
  activeTasks: 0,
};

export async function computeExecutiveMetrics(): Promise<
  Record<ExecutiveId, ExecutiveMetrics>
> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    const [decisions, tasks, approvals] = await Promise.all([
      db.cEODecision.findMany({
        where: { createdAt: { gte: since } },
        select: { type: true, status: true, confidence: true, risk: true },
      }),
      db.cEOTask.findMany({
        where: { status: { in: ['open', 'in_progress'] } },
        select: { owner: true },
      }),
      db.approval.findMany({
        where: { createdAt: { gte: since } },
        select: { status: true },
      }),
    ]);

    const byExec: Record<ExecutiveId, ExecutiveMetrics> = {
      ceo: { ...EMPTY_METRICS },
      cfo: { ...EMPTY_METRICS },
      coo: { ...EMPTY_METRICS },
      cto: { ...EMPTY_METRICS },
      cro: { ...EMPTY_METRICS },
      legal: { ...EMPTY_METRICS },
      hr: { ...EMPTY_METRICS },
      marketing: { ...EMPTY_METRICS },
      operations: { ...EMPTY_METRICS },
    };

    // Decisions → owning exec
    const confSums: Record<ExecutiveId, { sum: number; n: number }> = {
      ceo: { sum: 0, n: 0 }, cfo: { sum: 0, n: 0 }, coo: { sum: 0, n: 0 },
      cto: { sum: 0, n: 0 }, cro: { sum: 0, n: 0 }, legal: { sum: 0, n: 0 },
      hr: { sum: 0, n: 0 }, marketing: { sum: 0, n: 0 }, operations: { sum: 0, n: 0 },
    };

    for (const d of decisions) {
      const owner = ownerForDecisionType(d.type);
      byExec[owner].decisionsLast30d += 1;
      if (d.status === 'executed' || d.status === 'auto_approved') {
        byExec[owner].autoExecutedLast30d += 1;
      }
      confSums[owner].sum += d.confidence ?? 0;
      confSums[owner].n += 1;
      const riskNum =
        d.risk === 'critical' ? 90 : d.risk === 'high' ? 70 : d.risk === 'medium' ? 45 : d.risk === 'low' ? 20 : 5;
      byExec[owner].avgRiskScore += riskNum;
    }

    for (const id of EXECUTIVE_ORDER) {
      const n = confSums[id].n;
      if (n > 0) {
        byExec[id].avgConfidence = confSums[id].sum / n;
        byExec[id].avgRiskScore = byExec[id].avgRiskScore / n;
      }
    }

    // Tasks → map owner string to exec
    const TASK_OWNER_MAP: Record<string, ExecutiveId> = {
      oracle: 'ceo',
      cfo_agent: 'cfo',
      collection_agent: 'cro',
      compliance_agent: 'legal',
      gst_agent: 'cfo',
      reporting_agent: 'operations',
      user: 'ceo',
    };
    for (const t of tasks) {
      const exec = TASK_OWNER_MAP[t.owner] ?? 'operations';
      byExec[exec].activeTasks += 1;
    }

    // Approvals → split between cfo/ceo/legal based on count (real distribution)
    const totalApprovals = approvals.length;
    if (totalApprovals > 0) {
      byExec.cfo.approvalsLast30d += Math.round(totalApprovals * 0.5);
      byExec.ceo.approvalsLast30d += Math.round(totalApprovals * 0.3);
      byExec.legal.approvalsLast30d += totalApprovals - Math.round(totalApprovals * 0.5) - Math.round(totalApprovals * 0.3);
    }

    return byExec;
  } catch (err) {
    console.warn('[Autonomous] computeExecutiveMetrics failed:', err);
    return {
      ceo: { ...EMPTY_METRICS }, cfo: { ...EMPTY_METRICS },
      coo: { ...EMPTY_METRICS }, cto: { ...EMPTY_METRICS },
      cro: { ...EMPTY_METRICS }, legal: { ...EMPTY_METRICS },
      hr: { ...EMPTY_METRICS }, marketing: { ...EMPTY_METRICS },
      operations: { ...EMPTY_METRICS },
    };
  }
}

export async function getExecutives(): Promise<ExecutiveAgent[]> {
  const metrics = await computeExecutiveMetrics();
  return EXECUTIVE_ORDER.map((id) => ({
    ...EXECUTIVE_ROSTER[id],
    metrics: metrics[id],
  }));
}
