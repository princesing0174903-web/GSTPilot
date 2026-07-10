// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AUTONOMOUS ENTERPRISE™ — AI DECISION ENGINE
//
// The nine AI executives collaborate continuously. Every decision carries:
// business reasoning, risk score, expected ROI, confidence, supporting
// evidence, rollback strategy and human-approval requirements.
//
// Sources REAL signals from the live company observation + existing
// CEODecision records, then enriches each with the collaborating executives,
// ROI and rollback plan.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { ownerForDecisionType } from './executives';
import type {
  AutonomousAction,
  AutonomousDecision,
  CompanyObservation,
  DecisionEvidence,
  ExecutiveId,
} from './types';

// ─── Action catalog (what each decision type does when executed) ─────────────

const ACTION_CATALOG: Record<
  string,
  { label: string; agent: string; automated: boolean; destructive: boolean; minutes: number }[]
> = {
  recover_payment: [
    { label: 'Send payment reminder', agent: 'collection_agent', automated: true, destructive: false, minutes: 2 },
    { label: 'Escalate to WhatsApp', agent: 'collection_agent', automated: true, destructive: false, minutes: 3 },
    { label: 'Schedule recovery call', agent: 'operations', automated: false, destructive: false, minutes: 30 },
  ],
  pay_gst: [
    { label: 'Generate GST challan', agent: 'gst_agent', automated: true, destructive: false, minutes: 5 },
    { label: 'Reconcile 2A/2B', agent: 'gst_agent', automated: true, destructive: false, minutes: 10 },
    { label: 'File return', agent: 'gst_agent', automated: true, destructive: false, minutes: 8 },
  ],
  pay_vendor: [
    { label: 'Verify invoice', agent: 'coo', automated: true, destructive: false, minutes: 4 },
    { label: 'Schedule payment', agent: 'cfo_agent', automated: true, destructive: true, minutes: 5 },
    { label: 'Notify vendor', agent: 'operations', automated: true, destructive: false, minutes: 2 },
  ],
  approve_payroll: [
    { label: 'Validate attendance', agent: 'hr', automated: true, destructive: false, minutes: 6 },
    { label: 'Compute payroll', agent: 'hr', automated: true, destructive: false, minutes: 10 },
    { label: 'Disburse salaries', agent: 'cfo_agent', automated: true, destructive: true, minutes: 8 },
  ],
  follow_up_lead: [
    { label: 'Qualify lead', agent: 'cro', automated: true, destructive: false, minutes: 5 },
    { label: 'Generate proposal', agent: 'operations', automated: true, destructive: false, minutes: 12 },
    { label: 'Schedule follow-up', agent: 'operations', automated: false, destructive: false, minutes: 20 },
  ],
  reduce_expenses: [
    { label: 'Identify cuttable spend', agent: 'cfo_agent', automated: true, destructive: false, minutes: 8 },
    { label: 'Notify affected vendors', agent: 'coo', automated: true, destructive: false, minutes: 6 },
    { label: 'Pause recurring charges', agent: 'cfo_agent', automated: true, destructive: true, minutes: 4 },
  ],
  file_overdue_return: [
    { label: 'Pull missing invoices', agent: 'gst_agent', automated: true, destructive: false, minutes: 10 },
    { label: 'Prepare GSTR', agent: 'gst_agent', automated: true, destructive: false, minutes: 15 },
    { label: 'File + pay late fee', agent: 'legal', automated: true, destructive: true, minutes: 10 },
  ],
  investigate_anomaly: [
    { label: 'Isolate anomaly', agent: 'cto', automated: true, destructive: false, minutes: 8 },
    { label: 'Run root-cause', agent: 'cto', automated: true, destructive: false, minutes: 12 },
    { label: 'Apply fix / rollback', agent: 'cto', automated: true, destructive: true, minutes: 10 },
  ],
};

// ─── Rollback templates ───────────────────────────────────────────────────────

const ROLLBACK_TEMPLATES: Record<string, string> = {
  recover_payment:
    'Pause reminder sequence; revert any WhatsApp escalations; restore original due date if customer disputes.',
  pay_gst:
    'Void the filed return within GSTN correction window; reverse the challan payment; recompute liability.',
  pay_vendor:
    'Cancel scheduled NEFT/RTGS before cut-off; raise reversal request with bank; notify vendor of delay.',
  approve_payroll:
    'Hold disbursement before bank cut-off; reverse any posted entries; recompute with corrected inputs.',
  follow_up_lead:
    'Withdraw sent proposal; close scheduled follow-up; revert CRM stage to previous status.',
  reduce_expenses:
    'Re-enable paused recurring charges; restore cancelled vendor POs; re-issue purchase orders.',
  file_overdue_return:
    'File nil/supplementary return to correct; reverse late-fee challan if within window.',
  investigate_anomaly:
    'Roll back the applied fix; restore previous deployment; re-open incident for human review.',
};

const DEFAULT_ROLLBACK =
  'Revert the executed actions, restore prior state from audit log, and notify the proposing executive.';

// ─── Build the live decision stream from REAL signals ─────────────────────────

export async function buildLiveDecisions(
  obs: CompanyObservation,
): Promise<AutonomousDecision[]> {
  const decisions: AutonomousDecision[] = [];

  // 1. Cash shortage → CFO proposes optimize_cash / suggest_loan
  if (obs.runwayDays > 0 && obs.runwayDays < 30) {
    decisions.push(
      makeDecision({
        type: 'optimize_cash',
        title: 'Cash runway below 30 days — optimise working capital',
        reason: `Runway is ${obs.runwayDays} days at ₹${obs.burnRate}/mo burn. Immediate working-capital optimisation required.`,
        businessReasoning:
          'Low runway triggers CFO-led working capital review: accelerate collections, delay non-critical payables, and draw on available credit lines.',
        riskScore: 55,
        riskLevel: 'high',
        expectedROI: obs.burnRate * 0.3,
        expectedROIPct: 30,
        confidence: 0.82,
        evidence: [
          { source: 'AI CFO', fact: 'Current runway', value: obs.runwayDays },
          { source: 'AI CFO', fact: 'Monthly burn rate', value: obs.burnRate },
          { source: 'AI CFO', fact: 'Cash position', value: obs.cash },
        ],
        approvalRequired: 'cfo',
        proposedBy: 'cfo',
        collaborators: ['cfo', 'cro', 'coo'],
        financialImpact: obs.burnRate * 0.3,
        financialImpactLabel: `₹${Math.round(obs.burnRate * 0.3).toLocaleString('en-IN')} cash freed`,
      }),
    );
  }

  // 2. Overdue receivables → CRO proposes recover_payment
  if (obs.receivables > 0) {
    decisions.push(
      makeDecision({
        type: 'recover_payment',
        title: `Recover ₹${Math.round(obs.receivables).toLocaleString('en-IN')} outstanding receivables`,
        reason: `${obs.receivables > 0 ? 'Active' : 'No'} receivables on the books. Autonomous collection workflow can recover a meaningful share without manual intervention.`,
        businessReasoning:
          'CRO orchestrates the collection recovery workflow: reminder → WhatsApp → call → escalation. Each step logged; AI learns client payment behaviour for future prioritisation.',
        riskScore: 25,
        riskLevel: 'low',
        expectedROI: obs.receivables * 0.6,
        expectedROIPct: 60,
        confidence: 0.78,
        evidence: [
          { source: 'AI CFO', fact: 'Total outstanding', value: obs.receivables },
          { source: 'Digital Twin', fact: 'Clients', value: obs.clients },
        ],
        approvalRequired: 'manager',
        proposedBy: 'cro',
        collaborators: ['cro', 'operations', 'cfo'],
        financialImpact: obs.receivables * 0.6,
        financialImpactLabel: `₹${Math.round(obs.receivables * 0.6).toLocaleString('en-IN')} expected recovery`,
      }),
    );
  }

  // 3. GST payable → CFO proposes pay_gst
  if (obs.gst > 0) {
    decisions.push(
      makeDecision({
        type: 'pay_gst',
        title: `Prepare & file GST (₹${Math.round(obs.gst).toLocaleString('en-IN')} net liability)`,
        reason: 'Net GST liability is due. Autonomous GST workflow prepares the return, reconciles 2A/2B and files.',
        businessReasoning:
          'CFO + Legal collaborate to file on time, claim available ITC and avoid late-fee + penalty exposure.',
        riskScore: 30,
        riskLevel: 'medium',
        expectedROI: obs.gst * 0.0, // filing avoids penalty, not revenue
        expectedROIPct: 0,
        confidence: 0.9,
        evidence: [
          { source: 'AI CFO', fact: 'Net GST payable', value: obs.gst },
        ],
        approvalRequired: 'cfo',
        proposedBy: 'cfo',
        collaborators: ['cfo', 'legal'],
        financialImpact: -obs.gst,
        financialImpactLabel: `₹${Math.round(obs.gst).toLocaleString('en-IN')} outflow (avoids penalty)`,
      }),
    );
  }

  // 4. Compliance < 80 → Legal proposes review_compliance / file_overdue_return
  if (obs.compliance > 0 && obs.compliance < 80) {
    decisions.push(
      makeDecision({
        type: 'file_overdue_return',
        title: `Lift compliance score from ${obs.compliance}% → 95%+`,
        reason: 'Compliance score below threshold. Autonomous compliance workflow files overdue returns and clears notices.',
        businessReasoning:
          'Legal owns ROC + GST compliance. AI identifies every overdue filing, prepares, files, and updates the audit log — no manual chasing.',
        riskScore: 35,
        riskLevel: 'medium',
        expectedROI: 0,
        expectedROIPct: 0,
        confidence: 0.85,
        evidence: [
          { source: 'Digital Twin', fact: 'Compliance score', value: obs.compliance },
        ],
        approvalRequired: 'manager',
        proposedBy: 'legal',
        collaborators: ['legal', 'cfo', 'cto'],
        financialImpact: 0,
        financialImpactLabel: 'Avoids penalty exposure',
      }),
    );
  }

  // 5. Health score < 70 → CEO proposes holistic review
  if (obs.healthScore > 0 && obs.healthScore < 70) {
    decisions.push(
      makeDecision({
        type: 'improve_profitability',
        title: `Company Health Score ${obs.healthScore} — executive intervention`,
        reason: 'Health score below 70. CEO convenes strategy room to identify the top driver and assign owners.',
        businessReasoning:
          'CEO reviews the Business Graph root-cause analysis, assigns C-suite owners, and tracks recovery via the Goal Engine.',
        riskScore: 40,
        riskLevel: 'medium',
        expectedROI: obs.revenue * 0.08,
        expectedROIPct: 8,
        confidence: 0.7,
        evidence: [
          { source: 'AI CFO', fact: 'Health score', value: obs.healthScore },
          { source: 'AI CFO', fact: 'Top risk', value: 0 },
        ],
        approvalRequired: 'ceo',
        proposedBy: 'ceo',
        collaborators: ['ceo', 'cfo', 'cro', 'coo'],
        financialImpact: obs.revenue * 0.08,
        financialImpactLabel: `₹${Math.round(obs.revenue * 0.08).toLocaleString('en-IN')} profitability uplift`,
      }),
    );
  }

  // 6. High expense ratio → CFO proposes reduce_expenses
  if (obs.expenses > 0 && obs.revenue > 0 && obs.expenses / obs.revenue > 0.7) {
    const cut = obs.expenses * 0.12;
    decisions.push(
      makeDecision({
        type: 'reduce_expenses',
        title: `Cut operating expenses by 12% (₹${Math.round(cut).toLocaleString('en-IN')}/mo)`,
        reason: 'Expense ratio above 70% of revenue. CFO identifies cuttable recurring spend and pauses non-essential vendors.',
        businessReasoning:
          'CFO scans recurring expenses, benchmarks vendors, and pauses low-ROI spend. COO notifies affected vendors; CTO renews only essential subscriptions.',
        riskScore: 45,
        riskLevel: 'medium',
        expectedROI: cut,
        expectedROIPct: 12,
        confidence: 0.75,
        evidence: [
          { source: 'AI CFO', fact: 'Monthly expenses', value: obs.expenses },
          { source: 'AI CFO', fact: 'Expense ratio', value: Math.round((obs.expenses / obs.revenue) * 100) },
        ],
        approvalRequired: 'cfo',
        proposedBy: 'cfo',
        collaborators: ['cfo', 'coo', 'cto'],
        financialImpact: cut,
        financialImpactLabel: `₹${Math.round(cut).toLocaleString('en-IN')}/mo savings`,
      }),
    );
  }

  // 7. Merge in recent persisted CEODecisions (so the stream shows history too)
  try {
    const recent = await db.cEODecision.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
    });
    for (const r of recent) {
      // avoid duplicates with live-generated ones by type+title
      if (decisions.some((d) => d.type === r.type)) continue;
      decisions.push(
        makeDecision({
          id: r.id,
          type: r.type,
          title: r.title,
          reason: r.reason,
          businessReasoning: r.businessImpact || r.reason,
          riskScore:
            r.risk === 'critical' ? 90 : r.risk === 'high' ? 70 : r.risk === 'medium' ? 45 : r.risk === 'low' ? 20 : 5,
          riskLevel: (r.risk as AutonomousDecision['riskLevel']) || 'low',
          expectedROI: r.financialImpact || 0,
          expectedROIPct: r.financialImpact ? 10 : 0,
          confidence: r.confidence ?? 0.6,
          evidence: safeParse(r.evidence, []),
          approvalRequired: (r.approvalRequired as AutonomousDecision['approvalRequired']) || 'manager',
          proposedBy: ownerForDecisionType(r.type),
          collaborators: [ownerForDecisionType(r.type)],
          financialImpact: r.financialImpact || 0,
          financialImpactLabel: r.financialImpactLabel || '—',
          status: (r.status as AutonomousDecision['status']) || 'pending',
          createdAt: r.createdAt.toISOString(),
          executedAt: r.executedAt?.toISOString(),
          approvedBy: r.approvedBy ?? undefined,
          relatedEntityType: r.relatedEntityType ?? undefined,
          relatedEntityId: r.relatedEntityId ?? undefined,
          relatedEntityLabel: r.relatedEntityLabel ?? undefined,
        }),
      );
    }
  } catch (err) {
    console.warn('[Autonomous] loading recent CEODecisions failed:', err);
  }

  return decisions;
}

// ─── Decision factory ─────────────────────────────────────────────────────────

function makeDecision(input: {
  id?: string;
  type: string;
  title: string;
  reason: string;
  businessReasoning: string;
  riskScore: number;
  riskLevel: AutonomousDecision['riskLevel'];
  expectedROI: number;
  expectedROIPct: number;
  confidence: number;
  evidence: DecisionEvidence[];
  approvalRequired: AutonomousDecision['approvalRequired'];
  proposedBy: ExecutiveId;
  collaborators: ExecutiveId[];
  financialImpact: number;
  financialImpactLabel: string;
  status?: AutonomousDecision['status'];
  createdAt?: string;
  executedAt?: string;
  approvedBy?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  relatedEntityLabel?: string;
}): AutonomousDecision {
  const catalog = ACTION_CATALOG[input.type] ?? [
    { label: 'Execute action plan', agent: input.proposedBy, automated: false, destructive: false, minutes: 15 },
  ];
  const actions: AutonomousAction[] = catalog.map((a) => ({
    label: a.label,
    description: `${a.label} — executed by ${a.agent}`,
    agent: a.agent,
    estimatedMinutes: a.minutes,
    automated: a.automated,
    destructive: a.destructive,
  }));

  return {
    id: input.id ?? `live_${input.type}_${Date.now()}`,
    type: input.type,
    title: input.title,
    reason: input.reason,
    businessReasoning: input.businessReasoning,
    riskScore: input.riskScore,
    riskLevel: input.riskLevel,
    expectedROI: input.expectedROI,
    expectedROIPct: input.expectedROIPct,
    confidence: input.confidence,
    supportingEvidence: input.evidence,
    rollbackStrategy: ROLLBACK_TEMPLATES[input.type] ?? DEFAULT_ROLLBACK,
    approvalRequired: input.approvalRequired,
    proposedBy: input.proposedBy,
    collaborators: input.collaborators,
    status: input.status ?? (input.riskScore < 30 ? 'auto_approved' : 'pending'),
    financialImpact: input.financialImpact,
    financialImpactLabel: input.financialImpactLabel,
    actions,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    relatedEntityLabel: input.relatedEntityLabel,
    createdAt: input.createdAt ?? new Date().toISOString(),
    executedAt: input.executedAt,
    approvedBy: input.approvedBy,
  };
}

function safeParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
