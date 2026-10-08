// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI CEO™ — AI STRATEGY ENGINE™
//
// Oracle designs active business strategies across 8 categories: revenue
// growth, expense reduction, collections, GST compliance, profit margin,
// runway, client diversification, and customer-concentration reduction.
//
// Each strategy carries:
//   • Objectives   — 3-5 concrete outcomes
//   • Milestones   — 3-5 dated checkpoints
//   • KPIs         — 3-5 with baseline / target / current
//   • Timeline     — e.g. "90 days"
//   • Expected ROI — ₹ value and percentage
//   • Confidence   — 0-100
//   • Progress %   — computed from baseline → target
//
// Only strategies with meaningful baseline data are returned. Sorted by
// expectedROI (desc). No fabrication — every KPI ties back to live CFO/Twin.
//
// Tagline: VEYRO AI CEO™ — Run Your Business. Not Your Software.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  Strategy,
  StrategyMilestone,
  StrategyKPI,
  StrategyStatus,
} from './types';
import type { CEODataView } from './data';
import { formatINR } from './data';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let counter = 0;
function makeId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/** Compute progress as 0-100 from baseline → target → current. */
function progressPct(baseline: number, target: number, current: number): number {
  const span = target - baseline;
  if (Math.abs(span) < 1e-6) return current >= target ? 100 : 0;
  const pct = ((current - baseline) / span) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function strategyStatus(progress: number): StrategyStatus {
  if (progress >= 100) return 'completed';
  if (progress >= 60) return 'on_track';
  if (progress >= 30) return 'active';
  if (progress > 0) return 'at_risk';
  return 'proposed';
}

function milestone(label: string, daysOut: number, status: StrategyMilestone['status'] = 'pending'): StrategyMilestone {
  return { label, targetDate: daysFromNow(daysOut), status };
}

// ─── Strategy builders ───────────────────────────────────────────────────────

function buildRevenueGrowth(data: CEODataView): Strategy | null {
  const baseline = data.cfo.revenue.thisMonth;
  if (baseline <= 0) return null;

  const target = baseline * 1.20; // +20%
  const current = baseline;
  const progress = progressPct(baseline, target, current);
  const annualLift = (target - baseline) * 12;
  const roiPct = 20;

  return {
    id: makeId('strat-revenue'),
    title: 'Increase Monthly Revenue by 20%',
    description: `Grow monthly revenue from ${formatINR(baseline)} to ${formatINR(target)} via a mix of new-client acquisition, upsell to existing clients, and price optimisation.`,
    category: 'revenue',
    objectives: [
      'Acquire 3 new clients in the next 90 days',
      'Increase average deal size by 10% through value-based pricing',
      `Re-engage ${data.cfo.revenue.byClient.filter((c) => c.trend === 'down').length} dormant clients`,
      'Launch one new service line adjacent to current offerings',
    ],
    milestones: [
      milestone('Audit pipeline & set weekly lead targets', 7),
      milestone('Activate upsell campaign to top 5 clients', 30),
      milestone('Close first 2 new clients', 60),
      milestone(`Reach ${formatINR(target)} MRR`, 90, 'pending'),
    ],
    kpis: [
      { name: 'Monthly revenue', baseline, target, current, unit: 'inr' },
      { name: 'Active client count', baseline: data.liveState.clients, target: data.liveState.clients + 3, current: data.liveState.clients, unit: 'count' },
      { name: 'MoM growth %', baseline: data.cfo.revenue.growthPct, target: 20, current: data.cfo.revenue.growthPct, unit: 'pct' },
    ],
    timeline: '90 days',
    expectedROI: annualLift,
    expectedROIPct: roiPct,
    confidence: Math.min(85, 55 + Math.min(30, data.liveState.clients * 2)),
    status: strategyStatus(progress),
    progressPct: progress,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildReduceExpenses(data: CEODataView): Strategy | null {
  const baseline = data.cfo.expenses.totalThisMonth;
  if (baseline <= 0) return null;

  const target = baseline * 0.85; // -15%
  const current = baseline;
  const progress = progressPct(baseline, target, current);
  const annualSaving = (baseline - target) * 12;
  const roiPct = 15;

  return {
    id: makeId('strat-expenses'),
    title: 'Reduce Monthly Expenses by 15%',
    description: `Trim monthly operating expenses from ${formatINR(baseline)} to ${formatINR(target)} via vendor renegotiation, subscription audits, and discretionary spend controls.`,
    category: 'expenses',
    objectives: [
      'Audit all recurring subscriptions and cancel unused',
      `Renegotiate top 3 vendor contracts (current spend ${formatINR(data.cfo.profitability.vendorCosts.slice(0, 3).reduce((s, v) => s + v.totalSpend, 0))})`,
      'Cap discretionary categories (travel, marketing) at last month level',
      'Centralise software procurement to volume discounts',
    ],
    milestones: [
      milestone('Complete subscription audit', 7),
      milestone('Renegotiate #1 vendor contract', 21),
      milestone('Implement spend-approval workflow', 45),
      milestone(`Reach ${formatINR(target)}/mo expense base`, 90, 'pending'),
    ],
    kpis: [
      { name: 'Monthly expenses', baseline, target, current, unit: 'inr' },
      { name: 'Expense ratio (% of revenue)', baseline: data.cfo.profitability.expenseRatioPct, target: Math.max(0, data.cfo.profitability.expenseRatioPct - 5), current: data.cfo.profitability.expenseRatioPct, unit: 'pct' },
      { name: 'Recurring subscriptions count', baseline: data.cfo.expenses.byCategory.filter((c) => c.category === 'subscriptions' || c.category === 'software').length, target: 0, current: data.cfo.expenses.byCategory.filter((c) => c.category === 'subscriptions' || c.category === 'software').length, unit: 'count' },
    ],
    timeline: '90 days',
    expectedROI: annualSaving,
    expectedROIPct: roiPct,
    confidence: 75,
    status: strategyStatus(progress),
    progressPct: progress,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildImproveCollections(data: CEODataView): Strategy | null {
  const baseline = data.cfo.collections.collectionEfficiencyPct;
  if (baseline <= 0 && data.cfo.collections.totalOutstanding <= 0) return null;

  const target = 90; // 90% efficiency
  const current = baseline;
  const progress = progressPct(baseline, target, current);
  const overdueRecoverable = data.cfo.collections.overdueAmount;
  const annualLift = overdueRecoverable * 0.85; // recover 85% of overdue
  const roiPct = baseline > 0 ? Math.round(((target - baseline) / baseline) * 100) : 100;

  return {
    id: makeId('strat-collections'),
    title: 'Improve Collection Efficiency to 90%',
    description: `Lift collection efficiency from ${baseline.toFixed(1)}% to 90% via early reminders, structured dunning, and client-wise payment-term renegotiation. Overdue: ${formatINR(overdueRecoverable)}.`,
    category: 'collections',
    objectives: [
      'Send automated reminders 3 days before due date',
      `Recover ${formatINR(overdueRecoverable)} in overdue receivables`,
      `Renegotiate payment terms with ${data.cfo.collections.riskyClients.length} risky clients`,
      'Reduce average days-to-pay below 35',
    ],
    milestones: [
      milestone('Activate automated reminder workflow', 5),
      milestone('Recover 50% of overdue receivables', 30),
      milestone('Renegotiate terms with top 3 risky clients', 60),
      milestone('Reach 90% collection efficiency', 90, 'pending'),
    ],
    kpis: [
      { name: 'Collection efficiency %', baseline, target, current, unit: 'pct' },
      { name: 'Average days to pay', baseline: data.cfo.collections.averageDaysToPay, target: 35, current: data.cfo.collections.averageDaysToPay, unit: 'days' },
      { name: 'Overdue amount', baseline: overdueRecoverable, target: 0, current: overdueRecoverable, unit: 'inr' },
    ],
    timeline: '90 days',
    expectedROI: annualLift,
    expectedROIPct: roiPct,
    confidence: 70,
    status: strategyStatus(progress),
    progressPct: progress,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildGSTCompliance(data: CEODataView): Strategy | null {
  const baseline = data.liveState.compliance;
  if (baseline <= 0 && data.cfo.gst.pendingFilings === 0) return null;

  const target = 100;
  const current = baseline;
  const progress = progressPct(baseline, target, current);
  const annualRiskAvoided = data.cfo.gst.netGSTPayable * 0.18 + 365 * 50 * data.cfo.gst.overdueFilings;

  return {
    id: makeId('strat-gst'),
    title: 'Achieve 100% On-Time GST Compliance',
    description: `Raise compliance score from ${baseline}/100 to 100. Clear ${data.cfo.gst.overdueFilings} overdue filing(s) and ${data.cfo.gst.pendingFilings} pending filing(s). Eliminate late fees and interest.`,
    category: 'gst',
    objectives: [
      `File ${data.cfo.gst.overdueFilings} overdue return(s) within 7 days`,
      'Claim all eligible ITC before 180-day lapse',
      'Set up auto-filing for GSTR-1 and GSTR-3B',
      'Resolve open GST notices within statutory timelines',
    ],
    milestones: [
      milestone('File all overdue returns', 7),
      milestone('Reconcile 2A/2B and claim pending ITC', 21),
      milestone('Configure auto-filing pipeline', 45),
      milestone('Achieve 100% compliance score', 60, 'pending'),
    ],
    kpis: [
      { name: 'Compliance score', baseline, target, current, unit: 'pct' },
      { name: 'Overdue filings', baseline: data.cfo.gst.overdueFilings, target: 0, current: data.cfo.gst.overdueFilings, unit: 'count' },
      { name: 'ITC utilisation %', baseline: data.cfo.gst.itcUtilizationPct, target: 95, current: data.cfo.gst.itcUtilizationPct, unit: 'pct' },
    ],
    timeline: '60 days',
    expectedROI: annualRiskAvoided,
    expectedROIPct: baseline > 0 ? Math.round(((100 - baseline) / baseline) * 100) : 100,
    confidence: 85,
    status: strategyStatus(progress),
    progressPct: progress,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildProfitMargin(data: CEODataView): Strategy | null {
  const baseline = data.cfo.profitability.netMarginPct;
  if (baseline === 0 && data.liveState.revenue <= 0) return null;

  const target = 20; // 20% net margin
  const current = baseline;
  const progress = progressPct(baseline, target, current);
  const annualLift = data.liveState.revenue * 12 * ((target - baseline) / 100);

  return {
    id: makeId('strat-margin'),
    title: `Improve Net Profit Margin to 20%`,
    description: `Lift net margin from ${baseline.toFixed(1)}% to 20% via gross-margin expansion (price + COGS optimisation) and opex discipline.`,
    category: 'margin',
    objectives: [
      'Increase prices by 5-8% on top 5 SKUs/services',
      'Reduce COGS via vendor consolidation',
      'Cut discretionary opex by 10%',
      'Improve product mix toward higher-margin offerings',
    ],
    milestones: [
      milestone('Analyse per-customer profitability', 10),
      milestone('Roll out 5% price increase on top clients', 30),
      milestone('Switch to lower-cost vendors for top 3 categories', 60),
      milestone('Reach 20% net margin', 120, 'pending'),
    ],
    kpis: [
      { name: 'Net margin %', baseline, target, current, unit: 'pct' },
      { name: 'Gross margin %', baseline: data.cfo.profitability.grossMarginPct, target: data.cfo.profitability.grossMarginPct + 5, current: data.cfo.profitability.grossMarginPct, unit: 'pct' },
      { name: 'EBITDA margin %', baseline: data.cfo.profitability.ebitdaMarginPct, target: data.cfo.profitability.ebitdaMarginPct + 5, current: data.cfo.profitability.ebitdaMarginPct, unit: 'pct' },
    ],
    timeline: '120 days',
    expectedROI: annualLift,
    expectedROIPct: baseline > 0 ? Math.round(((target - baseline) / Math.max(1, baseline)) * 100) : 100,
    confidence: 65,
    status: strategyStatus(progress),
    progressPct: progress,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildRunway(data: CEODataView): Strategy | null {
  const baseline = data.liveState.runwayDays;
  if (baseline <= 0 && data.liveState.burnRate <= 0) return null;

  const target = 180;
  const current = baseline;
  const progress = progressPct(baseline, target, current);
  const monthlyBurn = data.liveState.burnRate || data.cfo.cashFlow.burnRatePerMonth;
  const cashGap = Math.max(0, monthlyBurn * (target - baseline) / 30);
  const annualValue = monthlyBurn * 6; // 6 extra months of operations secured

  return {
    id: makeId('strat-runway'),
    title: 'Extend Cash Runway to 180 Days',
    description: `Extend runway from ${baseline} days to 180 days via a mix of expense reduction, overdue recovery, and (if needed) a working-capital facility of ${formatINR(cashGap)}.`,
    category: 'runway',
    objectives: [
      'Reduce monthly burn by 15% via expense cuts',
      `Recover ${formatINR(data.cfo.collections.overdueAmount)} overdue receivables`,
      `Arrange ${formatINR(cashGap)} WC line if cash gap persists`,
      'Maintain 60-day minimum cash buffer going forward',
    ],
    milestones: [
      milestone('Activate expense-cut plan', 7),
      milestone('Recover 50% of overdue receivables', 30),
      milestone('Apply for WC facility (if needed)', 45),
      milestone('Reach 180-day runway', 90, 'pending'),
    ],
    kpis: [
      { name: 'Runway (days)', baseline, target, current, unit: 'days' },
      { name: 'Monthly burn', baseline: monthlyBurn, target: monthlyBurn * 0.85, current: monthlyBurn, unit: 'inr' },
      { name: 'Cash position', baseline: data.liveState.cash, target: data.liveState.cash + cashGap, current: data.liveState.cash, unit: 'inr' },
    ],
    timeline: '90 days',
    expectedROI: annualValue,
    expectedROIPct: baseline > 0 ? Math.round(((target - baseline) / baseline) * 100) : 100,
    confidence: 60,
    status: strategyStatus(progress),
    progressPct: progress,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildDiversifyClients(data: CEODataView): Strategy | null {
  const clients = data.cfo.revenue.byClient;
  if (clients.length === 0) return null;

  const baseline = clients.length;
  const target = baseline + 5; // add 5 new clients
  const current = baseline;
  const progress = progressPct(baseline, target, current);
  const avgClientRevenue = clients.reduce((s, c) => s + c.revenue, 0) / Math.max(1, clients.length);
  const annualLift = avgClientRevenue * 5 * 0.7; // 5 new clients at 70% of avg revenue

  return {
    id: makeId('strat-diversify'),
    title: 'Diversify Client Base (Add 5 New Clients)',
    description: `Reduce single-client revenue concentration by adding 5 new clients over the next quarter. Currently serving ${baseline} clients with avg revenue ${formatINR(avgClientRevenue)}/client.`,
    category: 'diversification',
    objectives: [
      'Activate outbound pipeline targeting 2 new industries',
      'Convert 5 qualified leads into paying clients',
      'Reduce top-client share from current level to below 25%',
      'Build referral program with existing clients',
    ],
    milestones: [
      milestone('Launch outbound campaign', 10),
      milestone('Generate 20 qualified leads', 30),
      milestone('Close first 2 new clients', 60),
      milestone('Close 5 new clients total', 90, 'pending'),
    ],
    kpis: [
      { name: 'Active client count', baseline, target, current, unit: 'count' },
      { name: 'Top client share %', baseline: clients[0]?.sharePct ?? 0, target: 25, current: clients[0]?.sharePct ?? 0, unit: 'pct' },
      { name: 'Industries served', baseline: data.cfo.revenue.byIndustry.length, target: data.cfo.revenue.byIndustry.length + 2, current: data.cfo.revenue.byIndustry.length, unit: 'count' },
    ],
    timeline: '90 days',
    expectedROI: annualLift,
    expectedROIPct: Math.round((5 / Math.max(1, baseline)) * 100),
    confidence: 60,
    status: strategyStatus(progress),
    progressPct: progress,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildReduceConcentration(data: CEODataView): Strategy | null {
  const topClient = data.cfo.revenue.byClient[0];
  if (!topClient || topClient.sharePct <= 0) return null;

  const baseline = topClient.sharePct;
  if (baseline < 20) return null; // only relevant when concentration > 20%

  const target = 20; // reduce to <20%
  const current = baseline;
  const progress = progressPct(baseline, target, current);
  const revenueAtRisk = topClient.revenue;

  return {
    id: makeId('strat-concentration'),
    title: `Reduce Customer Concentration (Top client: ${topClient.clientName})`,
    description: `Top client ${topClient.clientName} contributes ${baseline.toFixed(1)}% of revenue (${formatINR(topClient.revenue)}). Diversify to bring top-client share below 20% and de-risk revenue.`,
    category: 'diversification',
    objectives: [
      `Grow non-${topClient.clientName} revenue by 25%`,
      'Add 3 new mid-sized clients',
      'Sign multi-year contract with top client to lock revenue',
      'Build pipeline of replacement revenue',
    ],
    milestones: [
      milestone('Sign multi-year extension with top client', 30),
      milestone('Close 2 new mid-sized clients', 60),
      milestone('Grow non-top-client revenue by 15%', 90),
      milestone('Top-client share < 20%', 120, 'pending'),
    ],
    kpis: [
      { name: 'Top client share %', baseline, target, current, unit: 'pct' },
      { name: 'Non-top-1 client revenue', baseline: data.liveState.revenue - topClient.revenue, target: (data.liveState.revenue - topClient.revenue) * 1.25, current: data.liveState.revenue - topClient.revenue, unit: 'inr' },
      { name: 'Active clients', baseline: data.liveState.clients, target: data.liveState.clients + 3, current: data.liveState.clients, unit: 'count' },
    ],
    timeline: '120 days',
    expectedROI: revenueAtRisk * 0.5, // de-risk 50% of revenue concentration
    expectedROIPct: Math.round(((baseline - target) / Math.max(1, baseline)) * 100),
    confidence: 55,
    status: strategyStatus(progress),
    progressPct: progress,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── Main entry: compute all active strategies ───────────────────────────────

export function computeStrategies(data: CEODataView): Strategy[] {
  const builders = [
    buildRevenueGrowth,
    buildReduceExpenses,
    buildImproveCollections,
    buildGSTCompliance,
    buildProfitMargin,
    buildRunway,
    buildDiversifyClients,
    buildReduceConcentration,
  ];

  const strategies: Strategy[] = [];
  for (const b of builders) {
    try {
      const s = b(data);
      if (s) strategies.push(s);
    } catch (err) {
      console.warn(`[AI CEO Strategy] Builder ${b.name} failed:`, err);
    }
  }

  return strategies.sort((a, b) => b.expectedROI - a.expectedROI);
}
