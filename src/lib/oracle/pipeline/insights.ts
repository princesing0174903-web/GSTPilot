// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Autonomous Insights Engine (PROMPT 5)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Oracle proactively notices things — WITHOUT the user asking. Each insight is
// grounded in real data and includes:
//   • headline   — short punchy observation
//   • detail     — 1-2 sentence explanation with real numbers
//   • tone       — positive / negative / warning / opportunity
//   • metric     — the real number that triggered this insight
//   • actionPrompt — suggested next step (clickable)
//
// Examples:
//   "Revenue increased 18%"
//   "Collections decreased — 0% collected this month"
//   "GST liability unusually high — ₹8.3K payable"
//   "One client contributes 70% of revenue — concentration risk"
//   "Expenses rising — 12% of revenue"
//   "Cash runway shortening — 23 days remaining"
// ═══════════════════════════════════════════════════════════════════════════════

import 'server-only';
import type { AutonomousInsight, IntentId } from './types';
import type { BusinessSnapshot } from '@/lib/business/snapshot';
import { inr, pct } from './tools';

let insightCounter = 0;
function insightId(): string {
  insightCounter += 1;
  return `insight_${Date.now()}_${insightCounter}`;
}

/**
 * Generate proactive insights from real business data.
 * Each insight is a standalone observation Oracle noticed.
 */
export function generateInsights(
  snapshot: BusinessSnapshot | null,
  intent: IntentId,
): AutonomousInsight[] {
  const insights: AutonomousInsight[] = [];
  if (!snapshot) return insights;

  // ─── Revenue momentum ───────────────────────────────────────────────────────
  if (snapshot.revenueLastMonth > 0 && snapshot.revenueThisMonth > 0) {
    const growth = (snapshot.revenueThisMonth - snapshot.revenueLastMonth) / snapshot.revenueLastMonth;
    if (growth > 0.05) {
      insights.push({
        id: insightId(),
        headline: `Revenue up ${pct(growth)} month-over-month`,
        detail: `Revenue grew from ${inr(snapshot.revenueLastMonth)} to ${inr(snapshot.revenueThisMonth)}. Momentum is real — sustain it.`,
        tone: 'positive',
        metric: `+${pct(growth)} MoM`,
        actionPrompt: 'What drove my revenue growth this month?',
      });
    } else if (growth < -0.05) {
      insights.push({
        id: insightId(),
        headline: `Revenue down ${pct(Math.abs(growth))} month-over-month`,
        detail: `Revenue dropped from ${inr(snapshot.revenueLastMonth)} to ${inr(snapshot.revenueThisMonth)}. Investigate pipeline and customer churn.`,
        tone: 'negative',
        metric: `-${pct(Math.abs(growth))} MoM`,
        actionPrompt: 'Why did my revenue drop this month?',
      });
    }
  }

  // ─── Collections ────────────────────────────────────────────────────────────
  if (snapshot.revenue > 0 && snapshot.collectionRate < 0.7) {
    insights.push({
      id: insightId(),
      headline: `Collection rate is low at ${pct(snapshot.collectionRate)}`,
      detail: `Only ${pct(snapshot.collectionRate)} of billed revenue has been collected. ${inr(snapshot.overdueReceivables)} is overdue across ${snapshot.overdueInvoiceCount} invoices.`,
      tone: 'warning',
      metric: `${pct(snapshot.collectionRate)} collected`,
      actionPrompt: 'Which customers are delaying payments?',
    });
  }

  // ─── GST liability ──────────────────────────────────────────────────────────
  if (snapshot.gstLiability > snapshot.revenue * 0.1 && snapshot.revenue > 0) {
    insights.push({
      id: insightId(),
      headline: `GST liability unusually high — ${inr(snapshot.gstLiability)} payable`,
      detail: `Net GST liability is ${pct(snapshot.gstLiability / snapshot.revenue)} of revenue. Output tax ${inr(snapshot.outputTax)} minus ITC ${inr(snapshot.inputTax)}. File and pay before due date.`,
      tone: 'warning',
      metric: inr(snapshot.gstLiability),
      actionPrompt: 'Prepare my GSTR-3B and show net GST payable',
    });
  }

  // ─── Customer concentration ────────────────────────────────────────────────
  if (snapshot.topCustomerShare > 0.3) {
    insights.push({
      id: insightId(),
      headline: `One client contributes ${pct(snapshot.topCustomerShare)} of revenue`,
      detail: `Top customer concentration of ${pct(snapshot.topCustomerShare)} is above the safe threshold of 30%. Losing this client would cut revenue by ${pct(snapshot.topCustomerShare)}.`,
      tone: 'warning',
      metric: pct(snapshot.topCustomerShare),
      actionPrompt: 'Show my customer concentration breakdown',
    });
  }

  // ─── Expenses ───────────────────────────────────────────────────────────────
  if (snapshot.revenue > 0 && snapshot.expenses > 0) {
    const expenseRatio = snapshot.expenses / snapshot.revenue;
    if (expenseRatio > 0.7) {
      insights.push({
        id: insightId(),
        headline: `Expenses rising — ${pct(expenseRatio)} of revenue`,
        detail: `Expenses at ${inr(snapshot.expenses)} consume ${pct(expenseRatio)} of revenue ${inr(snapshot.revenue)}. Healthy benchmark is below 70%.`,
        tone: 'negative',
        metric: pct(expenseRatio),
        actionPrompt: 'Where can I reduce costs?',
      });
    }
  }

  // ─── Cash runway ────────────────────────────────────────────────────────────
  if (isFinite(snapshot.runwayDays) && snapshot.runwayDays < 90) {
    insights.push({
      id: insightId(),
      headline: `Cash runway shortening — ${snapshot.runwayDays} days remaining`,
      detail: `At current burn rate, cash of ${inr(snapshot.cash)} lasts ${snapshot.runwayDays} days. ${snapshot.runwayDays < 30 ? 'CRITICAL — secure collections or credit line.' : 'Plan a collection drive this month.'}`,
      tone: snapshot.runwayDays < 30 ? 'negative' : 'warning',
      metric: `${snapshot.runwayDays}d`,
      actionPrompt: 'How many days of cash runway do I have?',
    });
  }

  // ─── Compliance ────────────────────────────────────────────────────────────
  if (snapshot.overdueReturns > 0) {
    insights.push({
      id: insightId(),
      headline: `${snapshot.overdueReturns} GST return${snapshot.overdueReturns > 1 ? 's' : ''} overdue`,
      detail: `Late fees of ~₹${snapshot.overdueReturns * 100}/day are accruing. File immediately to stop penalty escalation.`,
      tone: 'negative',
      metric: `${snapshot.overdueReturns} overdue`,
      actionPrompt: 'Show all upcoming GST and compliance deadlines',
    });
  }

  // ─── Profitability strength (positive insight) ──────────────────────────────
  if (snapshot.profitMargin >= 0.3 && snapshot.revenue > 0) {
    insights.push({
      id: insightId(),
      headline: `Strong profitability — ${pct(snapshot.profitMargin)} net margin`,
      detail: `Profit margin of ${pct(snapshot.profitMargin)} is well above the 15% healthy benchmark. Profit of ${inr(snapshot.profit)} on revenue of ${inr(snapshot.revenue)}.`,
      tone: 'positive',
      metric: pct(snapshot.profitMargin),
      actionPrompt: 'Analyze my profit margin trend',
    });
  }

  // ─── Growth opportunity ─────────────────────────────────────────────────────
  if (snapshot.forecast.trend === 'up' && snapshot.forecast.confidence > 0.6) {
    insights.push({
      id: insightId(),
      headline: `Growth opportunity — forecast trending up`,
      detail: `Next month revenue is projected at ${inr(snapshot.forecast.nextMonthRevenue)} (${(snapshot.forecast.confidence * 100).toFixed(0)}% confidence). Ensure delivery capacity to capture the upside.`,
      tone: 'opportunity',
      metric: inr(snapshot.forecast.nextMonthRevenue),
      actionPrompt: 'Forecast my revenue for next month with confidence',
    });
  }

  // ─── Working capital ───────────────────────────────────────────────────────
  if (snapshot.workingCapital < 0) {
    insights.push({
      id: insightId(),
      headline: `Negative working capital — ${inr(snapshot.workingCapital)}`,
      detail: `Current liabilities exceed current assets. Short-term obligations may be at risk. Accelerate collections or arrange a credit line.`,
      tone: 'negative',
      metric: inr(snapshot.workingCapital),
      actionPrompt: 'How can I improve my working capital?',
    });
  }

  // Dedupe by headline (keep first occurrence).
  const seen = new Set<string>();
  const deduped = insights.filter((i) => {
    if (seen.has(i.headline)) return false;
    seen.add(i.headline);
    return true;
  });

  // For deep-dive intents, surface more insights. For specific intents, keep top 5.
  const limit = (intent === 'business_overview' || intent === 'report' || intent === 'risk') ? 10 : 5;
  return deduped.slice(0, limit);
}
