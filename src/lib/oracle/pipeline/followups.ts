// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Smart Follow-up Questions (PROMPT 5)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Instead of ending responses flatly, Oracle asks intelligent follow-up
// questions based on what it just discovered. Each follow-up is context-aware
// and tied to a real finding.
//
// Example:
//   "I noticed your collection rate is low.
//    Would you like me to identify which customers are delaying payments?"
// ═══════════════════════════════════════════════════════════════════════════════

import 'server-only';
import type { SmartFollowUp, IntentId, AutonomousInsight } from './types';
import type { BusinessSnapshot } from '@/lib/business/snapshot';
import { inr, pct } from './tools';

let fuCounter = 0;
function fuId(): string {
  fuCounter += 1;
  return `fu_${Date.now()}_${fuCounter}`;
}

/**
 * Generate context-aware follow-up questions based on the user's intent and
 * the real findings from this run.
 */
export function generateFollowUps(
  snapshot: BusinessSnapshot | null,
  intent: IntentId,
  insights: AutonomousInsight[],
): SmartFollowUp[] {
  const followUps: SmartFollowUp[] = [];
  if (!snapshot) {
    return [
      {
        id: fuId(),
        question: 'How do I connect my Zoho Books or bank account?',
        rationale: 'No business data connected yet',
      },
      {
        id: fuId(),
        question: 'What can Oracle do for my business?',
        rationale: 'Onboarding prompt',
      },
    ];
  }

  // ─── Collections-driven follow-ups ──────────────────────────────────────────
  if (snapshot.collectionRate < 0.7 && snapshot.overdueInvoiceCount > 0) {
    followUps.push({
      id: fuId(),
      question: 'Which customers are delaying payments?',
      rationale: `Collection rate is ${pct(snapshot.collectionRate)} with ${snapshot.overdueInvoiceCount} overdue invoices`,
    });
  }

  if (snapshot.overdueReceivables > 0) {
    followUps.push({
      id: fuId(),
      question: `Draft payment reminders for the ${inr(snapshot.overdueReceivables)} overdue?`,
      rationale: `${snapshot.overdueInvoiceCount} invoices past due`,
    });
  }

  // ─── Concentration-driven follow-ups ────────────────────────────────────────
  if (snapshot.topCustomerShare > 0.3) {
    followUps.push({
      id: fuId(),
      question: 'How can I diversify my customer base to reduce concentration risk?',
      rationale: `Top customer is ${pct(snapshot.topCustomerShare)} of revenue`,
    });
  }

  // ─── Cash-driven follow-ups ─────────────────────────────────────────────────
  if (isFinite(snapshot.runwayDays) && snapshot.runwayDays < 90) {
    followUps.push({
      id: fuId(),
      question: `What can I do to extend my ${snapshot.runwayDays}-day cash runway?`,
      rationale: 'Cash runway below 90 days',
    });
  }

  // ─── GST-driven follow-ups ──────────────────────────────────────────────────
  if (snapshot.gstLiability > 0) {
    followUps.push({
      id: fuId(),
      question: `Prepare my GSTR-3B for the ${inr(snapshot.gstLiability)} liability?`,
      rationale: 'GST liability is pending payment',
    });
  }

  if (snapshot.overdueReturns > 0) {
    followUps.push({
      id: fuId(),
      question: `File the ${snapshot.overdueReturns} overdue GST return${snapshot.overdueReturns > 1 ? 's' : ''} now?`,
      rationale: 'Penalties accruing daily',
    });
  }

  // ─── Growth-driven follow-ups ───────────────────────────────────────────────
  if (snapshot.forecast.trend === 'up') {
    followUps.push({
      id: fuId(),
      question: 'Forecast my revenue for the next 3 months',
      rationale: 'Momentum is positive — plan capacity',
    });
  }

  // ─── Profitability follow-ups ───────────────────────────────────────────────
  if (snapshot.profitMargin < 0.15 && snapshot.revenue > 0) {
    followUps.push({
      id: fuId(),
      question: 'Where can I cut costs to improve my margin?',
      rationale: `Margin at ${pct(snapshot.profitMargin)} is below 15%`,
    });
  }

  // ─── Intent-specific follow-ups ─────────────────────────────────────────────
  switch (intent) {
    case 'business_overview':
      followUps.push({
        id: fuId(),
        question: 'Generate a full CFO report with charts and recommendations',
        rationale: 'Deep-dive into the analysis',
      });
      break;
    case 'revenue':
      followUps.push({
        id: fuId(),
        question: 'Show my top 5 customers by revenue',
        rationale: 'Identify revenue drivers',
      });
      break;
    case 'gst':
      followUps.push({
        id: fuId(),
        question: 'Reconcile my ITC with GSTR-2B',
        rationale: 'Maximize legitimate ITC claims',
      });
      break;
    case 'cash':
      followUps.push({
        id: fuId(),
        question: 'Show my recent bank transactions',
        rationale: 'Trace cash movement',
      });
      break;
    case 'risk':
      followUps.push({
        id: fuId(),
        question: 'Give me a full risk mitigation plan',
        rationale: 'Convert risk findings into action',
      });
      break;
    case 'customers':
      followUps.push({
        id: fuId(),
        question: 'Show my most risky clients and why',
        rationale: 'Prioritize customer outreach',
      });
      break;
    case 'forecast':
      followUps.push({
        id: fuId(),
        question: 'How accurate was last month\'s forecast?',
        rationale: 'Calibrate the forecast model',
      });
      break;
  }

  // ─── Insight-driven follow-ups (highest priority) ───────────────────────────
  for (const ins of insights.slice(0, 2)) {
    if (ins.actionPrompt && !followUps.some((f) => f.question === ins.actionPrompt)) {
      followUps.unshift({
        id: fuId(),
        question: ins.actionPrompt,
        rationale: ins.headline,
      });
    }
  }

  // Dedupe by question.
  const seen = new Set<string>();
  const deduped = followUps.filter((f) => {
    if (seen.has(f.question)) return false;
    seen.add(f.question);
    return true;
  });

  return deduped.slice(0, 4);
}
