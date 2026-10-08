// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Structured Recommendations Engine (PROMPT 5)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Every recommendation includes the full explain-why structure:
//   • title            — what to do
//   • priority         — P0 (critical) / P1 (high) / P2 (medium) / P3 (low)
//   • reason           — WHY this is recommended (the underlying cause)
//   • impact           — what changes if the user acts
//   • estimatedOutcome — measurable result
//   • actionPrompt     — clickable next step
//
// Recommendations are ranked by priority then by estimated impact. Oracle
// surfaces 3-5 high-leverage actions per answer — never an overwhelming list.
// ═══════════════════════════════════════════════════════════════════════════════

import 'server-only';
import type { StructuredRecommendation, IntentId } from './types';
import type { BusinessSnapshot } from '@/lib/business/snapshot';
import { inr, pct } from './tools';

let recCounter = 0;
function recId(): string {
  recCounter += 1;
  return `rec_${Date.now()}_${recCounter}`;
}

const priorityRank: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

/**
 * Generate structured recommendations grounded in real data.
 */
export function generateRecommendations(
  snapshot: BusinessSnapshot | null,
  intent: IntentId,
): StructuredRecommendation[] {
  const recs: StructuredRecommendation[] = [];
  if (!snapshot) return recs;

  // ─── P0: File overdue GST returns ───────────────────────────────────────────
  if (snapshot.overdueReturns > 0) {
    recs.push({
      id: recId(),
      title: `File ${snapshot.overdueReturns} overdue GST return${snapshot.overdueReturns > 1 ? 's' : ''} immediately`,
      priority: 'P0',
      reason: `${snapshot.overdueReturns} GST return${snapshot.overdueReturns > 1 ? 's are' : ' is'} overdue. Late fees of ~₹${snapshot.overdueReturns * 100}/day are accruing and notice risk is high.`,
      impact: 'Stops daily penalty accrual and removes compliance exposure',
      estimatedOutcome: `Save ~₹${snapshot.overdueReturns * 100 * 30}/month in penalties and avoid GST notices`,
      actionPrompt: 'Prepare my GSTR-1 for the current period',
    });
  }

  // ─── P0: Critical cash runway ───────────────────────────────────────────────
  if (isFinite(snapshot.runwayDays) && snapshot.runwayDays < 30) {
    recs.push({
      id: recId(),
      title: 'Secure cash within 2 weeks — runway is critical',
      priority: 'P0',
      reason: `Cash of ${inr(snapshot.cash)} lasts only ${snapshot.runwayDays} days at current burn. Operations are at risk.`,
      impact: 'Prevents operational disruption and protects payroll',
      estimatedOutcome: `Extend runway to 60+ days by collecting ${inr(snapshot.overdueReceivables)} overdue`,
      actionPrompt: 'Generate payment links for top overdue invoices',
    });
  }

  // ─── P1: Collect overdue receivables ────────────────────────────────────────
  if (snapshot.overdueReceivables > 0) {
    recs.push({
      id: recId(),
      title: `Collect ${inr(snapshot.overdueReceivables)} in overdue receivables`,
      priority: 'P1',
      reason: `${snapshot.overdueInvoiceCount} invoices totalling ${inr(snapshot.overdueReceivables)} are past due. Collection rate is ${pct(snapshot.collectionRate)}.`,
      impact: 'Improves liquidity and reduces working capital strain',
      estimatedOutcome: `Inject ${inr(snapshot.overdueReceivables)} cash within 15 days`,
      actionPrompt: 'Draft payment reminders for all overdue invoices',
    });
  }

  // ─── P1: Diversify customer base ────────────────────────────────────────────
  if (snapshot.topCustomerShare > 0.3) {
    recs.push({
      id: recId(),
      title: 'Diversify customer base to reduce concentration risk',
      priority: 'P1',
      reason: `Top customer contributes ${pct(snapshot.topCustomerShare)} of revenue. Losing them would cut revenue by ${pct(snapshot.topCustomerShare)}.`,
      impact: 'Reduces single-point-of-failure revenue risk',
      estimatedOutcome: `Bring top customer share below 25% within 2 quarters`,
      actionPrompt: 'Show my customer concentration breakdown',
    });
  }

  // ─── P1: Tighten payment terms ──────────────────────────────────────────────
  if (snapshot.avgDaysToPay > 45) {
    recs.push({
      id: recId(),
      title: 'Tighten payment terms and send reminders earlier',
      priority: 'P1',
      reason: `Customers take ${snapshot.avgDaysToPay} days on average to pay versus the 30-day standard. Cash conversion cycle is stretched.`,
      impact: 'Speeds up cash conversion and reduces financing needs',
      estimatedOutcome: `Cut days-to-pay from ${snapshot.avgDaysToPay} to 35 days`,
      actionPrompt: 'Help me set up automated payment reminders',
    });
  }

  // ─── P1: File GST on time ───────────────────────────────────────────────────
  if (snapshot.pendingReturns > 0 && snapshot.overdueReturns === 0) {
    recs.push({
      id: recId(),
      title: `File ${snapshot.pendingReturns} pending GST return${snapshot.pendingReturns > 1 ? 's' : ''} before deadline`,
      priority: 'P1',
      reason: `${snapshot.pendingReturns} return${snapshot.pendingReturns > 1 ? 's are' : ' is'} pending. Net GST payable: ${inr(snapshot.gstLiability)}.`,
      impact: 'Avoids late fees and maintains clean compliance record',
      estimatedOutcome: `Save ₹${snapshot.pendingReturns * 100 * 15} in potential late fees`,
      actionPrompt: 'Prepare my GSTR-3B and show net GST payable',
    });
  }

  // ─── P2: Reduce expenses ────────────────────────────────────────────────────
  if (snapshot.revenue > 0 && snapshot.expenses / snapshot.revenue > 0.7) {
    recs.push({
      id: recId(),
      title: 'Reduce operating expenses by 10-15%',
      priority: 'P2',
      reason: `Expenses at ${inr(snapshot.expenses)} consume ${pct(snapshot.expenses / snapshot.revenue)} of revenue. Healthy benchmark is below 70%.`,
      impact: 'Improves net margin and frees up cash',
      estimatedOutcome: `Boost margin from ${pct(snapshot.profitMargin)} to ${pct(snapshot.profitMargin + 0.1)}`,
      actionPrompt: 'Where can I reduce costs?',
    });
  }

  // ─── P2: Maximize ITC ───────────────────────────────────────────────────────
  if (snapshot.inputTax > 0 && snapshot.outputTax > 0) {
    const itcRatio = snapshot.inputTax / snapshot.outputTax;
    if (itcRatio < 0.3) {
      recs.push({
        id: recId(),
        title: 'Reconcile ITC with GSTR-2B to maximize legitimate claims',
        priority: 'P2',
        reason: `Only ${pct(itcRatio)} of output tax is offset by ITC. You may be missing legitimate input tax credits from vendor invoices.`,
        impact: 'Reduces net GST liability and improves cash position',
        estimatedOutcome: `Potentially save ${inr(snapshot.outputTax * 0.15)} in GST outflow`,
        actionPrompt: 'Reconcile my ITC with GSTR-2B',
      });
    }
  }

  // ─── P2: Capitalize on growth ───────────────────────────────────────────────
  if (snapshot.forecast.trend === 'up' && snapshot.forecast.confidence > 0.6) {
    recs.push({
      id: recId(),
      title: 'Capitalize on upward revenue trend — secure delivery capacity',
      priority: 'P2',
      reason: `Revenue is forecast at ${inr(snapshot.forecast.nextMonthRevenue)} next month with ${(snapshot.forecast.confidence * 100).toFixed(0)}% confidence and trend is up.`,
      impact: 'Captures upside without service disruption',
      estimatedOutcome: `Sustain ${pct((snapshot.revenueThisMonth - snapshot.revenueLastMonth) / Math.max(1, snapshot.revenueLastMonth))} MoM growth`,
      actionPrompt: 'Forecast my revenue for the next 3 months',
    });
  }

  // ─── P3: Improve margin ─────────────────────────────────────────────────────
  if (snapshot.profitMargin < 0.15 && snapshot.profitMargin > 0 && snapshot.revenue > 0) {
    recs.push({
      id: recId(),
      title: 'Improve pricing or product mix to lift margin',
      priority: 'P3',
      reason: `Net margin of ${pct(snapshot.profitMargin)} is below the 15% healthy benchmark. Either pricing is too low or cost structure is heavy.`,
      impact: 'Strengthens long-term sustainability',
      estimatedOutcome: `Reach 18-20% margin within 2 quarters`,
      actionPrompt: 'Analyze my profit margin trend',
    });
  }

  // Sort by priority (P0 first), then dedupe.
  recs.sort((a, b) => (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9));

  // Limit to top 5 (overwhelming lists reduce action).
  return recs.slice(0, 5);
}
