// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI CFO™ Phase 1 — AI CFO RECOMMENDATIONS
//
// Generates executive advice based on real business data. Every recommendation
// includes:
//   • Reason (WHY it's recommended)
//   • Financial Impact (₹ amount + description)
//   • Priority (critical / high / medium / low)
//   • Confidence (0-100%)
//
// Triggers cover the user's spec:
//   • Reduce marketing spend
//   • Recover ₹X receivables
//   • Delay equipment purchase
//   • Claim pending ITC
//   • Increase inventory
//   • Reduce vendor dependency
//   • Improve cash runway
//   • + more
// ═══════════════════════════════════════════════════════════════════════════════

import type { AIRecommendations, AIRecommendation, RecommendationPriority } from '../types';
import type { RawCFOData } from './data';
import type { RevenueAnalytics } from '../types';
import type { ProfitabilityAnalytics } from '../types';
import type { CashFlowAnalytics } from '../types';
import type { WorkingCapitalAnalytics } from '../types';
import type { CollectionAnalytics } from '../types';
import type { ForecastAnalytics } from '../types';
import type { BusinessRiskEngine } from '../types';

interface RecContext {
  revenue: RevenueAnalytics;
  profitability: ProfitabilityAnalytics;
  cashFlow: CashFlowAnalytics;
  workingCapital: WorkingCapitalAnalytics;
  collections: CollectionAnalytics;
  forecast: ForecastAnalytics;
  risks: BusinessRiskEngine;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export function computeRecommendations(data: RawCFOData, ctx: RecContext): AIRecommendations {
  const recs: AIRecommendation[] = [];

  // ─── 1. Recover Receivables ────────────────────────────────────────────────
  const overdueAmount = ctx.collections.overdueAmount;
  if (overdueAmount > 0) {
    const impact = overdueAmount * 0.7; // expect to recover 70%
    recs.push({
      id: 'rec-recover-receivables',
      title: 'Recover overdue receivables',
      reason: `${ctx.collections.overdueCount} invoice(s) totalling ${inr(overdueAmount)} are overdue. This is your own money trapped in receivables — recovering it directly improves cash flow without taking on debt.`,
      financialImpact: `${inr(impact)} expected recovery (70% of overdue)`,
      financialImpactValue: impact,
      priority: overdueAmount > 500000 ? 'critical' : overdueAmount > 100000 ? 'high' : 'medium',
      confidencePct: 85,
      category: 'cash_flow',
      actions: [
        `Send WhatsApp reminders to all ${ctx.collections.overdueCount} overdue clients today`,
        'Call top 5 overdue clients directly this week',
        'Offer 1% early-payment discount for settlement within 7 days',
        'Escalate invoices >60 days overdue to formal demand letter',
        'Tighten credit terms to 15 days for repeat late payers',
      ],
      timeframe: '7_days',
    });
  }

  // ─── 2. Claim Pending ITC ──────────────────────────────────────────────────
  const totalITC = data.purchaseBills.reduce((s, p) => s + (p.gstAmount || (p.cgst + p.sgst + p.igst + p.cess)), 0);
  const itcAtRisk = data.purchaseBills
    .filter((p) => {
      const age = (Date.now() - new Date(p.invoiceDate).getTime()) / (1000 * 60 * 60 * 24);
      return age > 180 && p.paymentStatus !== 'paid';
    })
    .reduce((s, p) => s + (p.gstAmount || (p.cgst + p.sgst + p.igst + p.cess)), 0);
  if (totalITC > 0) {
    recs.push({
      id: 'rec-claim-itc',
      title: 'Claim pending Input Tax Credit',
      reason: `${inr(totalITC)} of input tax credit is available from purchase bills. ${itcAtRisk > 0 ? `${inr(itcAtRisk)} is at risk of lapsing if not claimed within statutory timeline (Section 16(4)). ` : ''}Unclaimed ITC is direct cash loss — every ₹1 of unclaimed ITC = ₹1 of extra GST payable.`,
      financialImpact: `${inr(totalITC)} GST savings`,
      financialImpactValue: totalITC,
      priority: itcAtRisk > 0 ? 'critical' : totalITC > 100000 ? 'high' : 'medium',
      confidencePct: 95,
      category: 'compliance',
      actions: [
        'Reconcile GSTR-2B vs purchase register',
        'Claim eligible ITC in next GSTR-3B filing',
        `Follow up with vendors on ${data.purchaseBills.filter((p) => !p.vendorGstin).length} unmatched invoices`,
        'Flag blocked credits for vendor follow-up',
        'Set up monthly ITC aging review',
      ],
      timeframe: 'immediate',
    });
  }

  // ─── 3. Reduce Marketing Spend (if marketing is >20% of expenses) ──────────
  const marketingExpense = data.expenses
    .filter((e) => {
      const cat = (e.category || '').toLowerCase();
      const d = new Date(e.date);
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return cat.includes('marketing') || cat.includes('advertising') || cat.includes('ads');
    })
    .reduce((s, e) => s + (e.amount || 0), 0);
  const totalExpenses = ctx.profitability.opex + ctx.profitability.cogs;
  if (marketingExpense > 0 && totalExpenses > 0 && (marketingExpense / totalExpenses) > 0.15) {
    const reduction = marketingExpense * 0.3; // suggest 30% cut
    recs.push({
      id: 'rec-reduce-marketing',
      title: 'Reduce marketing spend by 30%',
      reason: `Marketing expenses (${inr(marketingExpense)}) account for ${((marketingExpense / totalExpenses) * 100).toFixed(0)}% of total expenses — above the healthy 15% threshold for a services business. With ${ctx.collections.overdueCount} overdue invoices and ${ctx.cashFlow.runwayDays > 0 ? ctx.cashFlow.runwayDays + ' days' : 'ample'} runway, reallocating marketing budget to collections recovery will yield higher ROI.`,
      financialImpact: `Saves ${inr(reduction)}/month`,
      financialImpactValue: reduction * 12, // annualized
      priority: 'medium',
      confidencePct: 75,
      category: 'cost_reduction',
      actions: [
        'Pause underperforming ad campaigns (review CAC by channel)',
        'Reallocate 50% of marketing budget to collections recovery',
        'Focus on referral/organic channels with proven ROI',
        'Review marketing budget monthly until collection efficiency > 85%',
      ],
      timeframe: '7_days',
    });
  }

  // ─── 4. Delay Equipment Purchase (if cash position weak) ───────────────────
  if (ctx.cashFlow.runwayDays > 0 && ctx.cashFlow.runwayDays < 90) {
    recs.push({
      id: 'rec-delay-equipment',
      title: 'Delay non-essential equipment purchase',
      reason: `Cash runway is ${ctx.cashFlow.runwayDays} days — below the safe 90-day threshold. Any capex commitment now would consume cash needed for payroll, vendor payments, and GST filings. Defer equipment purchases until runway exceeds 120 days.`,
      financialImpact: `Preserves ${inr(ctx.cashFlow.availableCash * 0.2)} cash buffer (est. 20% of available)`,
      financialImpactValue: ctx.cashFlow.availableCash * 0.2,
      priority: 'high',
      confidencePct: 90,
      category: 'cash_flow',
      actions: [
        'Freeze all non-essential capex for 90 days',
        'Lease instead of buy where possible',
        'Re-evaluate after runway exceeds 120 days',
        'Consider used/refurbished equipment if purchase is unavoidable',
      ],
      timeframe: 'immediate',
    });
  }

  // ─── 5. Reduce Vendor Dependency (if top vendor >40% share) ────────────────
  const vendorAgg = new Map<string, { spend: number; name: string }>();
  for (const p of data.purchaseBills) {
    const key = p.vendorGstin || p.vendorName;
    const existing = vendorAgg.get(key) || { spend: 0, name: p.vendorName };
    existing.spend += p.totalAmount || 0;
    vendorAgg.set(key, existing);
  }
  const sortedVendors = Array.from(vendorAgg.entries())
    .map(([k, v]) => ({ key: k, name: v.name, spend: v.spend }))
    .sort((a, b) => b.spend - a.spend);
  const totalSpend = sortedVendors.reduce((s, v) => s + v.spend, 0);
  const topVendor = sortedVendors[0];
  if (topVendor && totalSpend > 0 && (topVendor.spend / totalSpend) > 0.40) {
    const share = (topVendor.spend / totalSpend) * 100;
    recs.push({
      id: 'rec-reduce-vendor-dependency',
      title: `Reduce dependency on ${topVendor.name}`,
      reason: `${topVendor.name} accounts for ${share.toFixed(0)}% of vendor spend (${inr(topVendor.spend)}). Single-vendor concentration creates supply risk and reduces negotiating leverage. Diversifying will improve resilience and likely secure better pricing.`,
      financialImpact: `${inr(topVendor.spend * 0.1)} potential savings (10% via competitive bidding)`,
      financialImpactValue: topVendor.spend * 0.1,
      priority: share > 60 ? 'high' : 'medium',
      confidencePct: 70,
      category: 'risk_mitigation',
      actions: [
        `Onboard 2 backup vendors for ${topVendor.name}'s category`,
        'Run competitive RFQ on top 3 spend categories',
        'Negotiate volume discounts with current vendor using competing quotes',
        'Maintain 30% max share per vendor going forward',
      ],
      timeframe: '30_days',
    });
  }

  // ─── 6. Improve Cash Runway (if runway < 60 days) ──────────────────────────
  if (ctx.cashFlow.runwayDays > 0 && ctx.cashFlow.runwayDays < 60) {
    const target = 120;
    const gap = (target - ctx.cashFlow.runwayDays) * ctx.cashFlow.burnRatePerDay;
    recs.push({
      id: 'rec-improve-runway',
      title: 'Improve cash runway to 120+ days',
      reason: `Current runway is ${ctx.cashFlow.runwayDays} days, target is ${target}+ days. Gap of ${inr(gap)} needs to be closed via collections + expense deferral + working capital facility. Improving runway reduces solvency risk and unlocks growth optionality.`,
      financialImpact: `Extends runway by ${target - ctx.cashFlow.runwayDays} days`,
      financialImpactValue: gap,
      priority: ctx.cashFlow.runwayDays < 30 ? 'critical' : 'high',
      confidencePct: 80,
      category: 'cash_flow',
      actions: [
        'Recover overdue receivables (see "Recover receivables" recommendation)',
        'Negotiate extended payment terms with top 5 vendors',
        'Arrange ₹5-10L working capital line of credit (not term loan)',
        'Defer all discretionary spend 30 days',
        'Accelerate invoicing for completed work',
      ],
      timeframe: '30_days',
    });
  }

  // ─── 7. Increase Inventory (if working capital very strong) ────────────────
  if (ctx.workingCapital.workingCapitalRatio > 2.5 && ctx.workingCapital.currentAssets > 1000000) {
    recs.push({
      id: 'rec-increase-inventory',
      title: 'Deploy excess cash for growth',
      reason: `Working capital ratio is ${ctx.workingCapital.workingCapitalRatio.toFixed(2)} with ${inr(ctx.workingCapital.currentAssets)} in current assets — significantly above the healthy 1.5-2.0 range. Excess cash is earning nothing in the bank. Consider deploying into inventory (if product business), marketing (if ROI-proven), or short-term deposits.`,
      financialImpact: `${inr(ctx.workingCapital.currentAssets * 0.2)} redeployed at 8-12% return potential`,
      financialImpactValue: ctx.workingCapital.currentAssets * 0.2 * 0.10,
      priority: 'low',
      confidencePct: 65,
      category: 'growth',
      actions: [
        'Move 20% of excess cash to liquid funds (6-7% return)',
        'Invest in proven marketing channels (CAC < 3x LTV)',
        'Build 30-day inventory buffer for top SKUs (if applicable)',
        'Consider strategic acquisition or hire if ROI justifies',
      ],
      timeframe: '90_days',
    });
  }

  // ─── 8. File Overdue Returns (if any overdue) ──────────────────────────────
  const overdueFilings = data.filings.filter((f) => {
    if (f.status === 'filed') return false;
    const [y, m] = f.period.split('-').map(Number);
    if (!y || !m) return false;
    const rt = (f.returnType || '').toUpperCase();
    const due = rt === 'GSTR-1' ? new Date(y, m, 11) : rt === 'GSTR-3B' ? new Date(y, m, 20) : new Date(y, m, 20);
    return due < new Date();
  });
  if (overdueFilings.length > 0) {
    const penaltyPerDay = overdueFilings.length * 50; // ₹50/day per filing
    const oldestFiling = overdueFilings[0];
    const ageDays = Math.floor((Date.now() - new Date(oldestFiling.period + '-01').getTime()) / (1000 * 60 * 60 * 24));
    recs.push({
      id: 'rec-file-returns',
      title: `File ${overdueFilings.length} overdue GST return(s)`,
      reason: `${overdueFilings.length} GST return(s) are overdue. Late fee of ₹50/day per filing + 18% p.a. interest is accruing. Non-filing can trigger notices, ITC block, and assessment proceedings. Filing immediately stops the bleed.`,
      financialImpact: `Stops ${inr(penaltyPerDay)}/day penalty accrual`,
      financialImpactValue: penaltyPerDay * 30, // monthly savings
      priority: 'critical',
      confidencePct: 98,
      category: 'compliance',
      actions: [
        `File ${overdueFilings.length} overdue return(s) within 48 hours`,
        'Pay any pending GST liability with the filing',
        'Set up auto-reminders 5 days before each due date',
        'Assign dedicated filer per client segment',
        'Respond to any open notices related to these filings',
      ],
      timeframe: 'immediate',
    });
  }

  // ─── 9. Re-engage Top Clients (if revenue concentrated) ────────────────────
  const topClient = ctx.revenue.byClient[0];
  if (topClient && topClient.sharePct > 25) {
    recs.push({
      id: 'rec-diversify-clients',
      title: 'Diversify client base',
      reason: `Top client "${topClient.clientName}" represents ${topClient.sharePct}% of revenue. Losing them would be catastrophic. Diversification reduces single-point-of-failure risk and improves negotiating leverage.`,
      financialImpact: `${inr(topClient.revenue * 0.3)} protected by reducing concentration`,
      financialImpactValue: topClient.revenue * 0.3,
      priority: topClient.sharePct > 50 ? 'high' : 'medium',
      confidencePct: 70,
      category: 'risk_mitigation',
      actions: [
        'Target 3 new client acquisitions in adjacent verticals',
        'Sign multi-year contract with top client (lock in revenue)',
        'Build referral pipeline with existing clients',
        'Invest in marketing to top 2 underserved segments',
      ],
      timeframe: '90_days',
    });
  }

  // ─── 10. Reduce Operating Costs (if expense ratio high) ────────────────────
  if (ctx.profitability.expenseRatioPct > 75) {
    const reduction = ctx.profitability.opex * 0.15;
    recs.push({
      id: 'rec-reduce-opex',
      title: 'Reduce operating expenses by 15%',
      reason: `Expense ratio is ${ctx.profitability.expenseRatioPct}% — meaning ₹${ctx.profitability.expenseRatioPct} of every ₹100 in revenue goes to expenses. Reducing opex by 15% would lift net margin from ${ctx.profitability.netMarginPct}% to ~${(ctx.profitability.netMarginPct + 15 * (100 - ctx.profitability.expenseRatioPct) / 100).toFixed(1)}%.`,
      financialImpact: `${inr(reduction)}/month saved`,
      financialImpactValue: reduction * 12,
      priority: 'high',
      confidencePct: 80,
      category: 'cost_reduction',
      actions: [
        'Audit all subscriptions, cancel unused (save ₹5-15K/month typical)',
        'Renegotiate software licenses annually',
        'Convert fixed salaries to variable where possible',
        'Implement expense approval workflow',
        'Review travel & conveyance policy',
      ],
      timeframe: '30_days',
    });
  }

  // ─── 11. Accelerate Invoicing (if collection efficiency low) ───────────────
  if (ctx.collections.collectionEfficiencyPct < 80) {
    recs.push({
      id: 'rec-accelerate-invoicing',
      title: 'Accelerate invoicing & collections cycle',
      reason: `Collection efficiency is ${ctx.collections.collectionEfficiencyPct}% — below the healthy 85% threshold. Faster invoicing + tighter payment terms will improve cash conversion. Average days to pay is ${ctx.collections.averageDaysToPay}.`,
      financialImpact: `${inr(ctx.collections.totalOutstanding * 0.2)} faster collection`,
      financialImpactValue: ctx.collections.totalOutstanding * 0.2,
      priority: 'medium',
      confidencePct: 75,
      category: 'cash_flow',
      actions: [
        'Invoice within 24 hours of service delivery (not month-end)',
        'Move to 15-day payment terms (from 30-day) for new clients',
        'Offer 1% early-payment discount for 7-day settlement',
        'Send automated reminders 3 days before + on + 7 days after due date',
        'Use UPI/digital payment links on invoices',
      ],
      timeframe: '7_days',
    });
  }

  // ─── 12. Build Emergency Reserve (if no reserve) ───────────────────────────
  if (ctx.cashFlow.runwayDays === 0 && ctx.cashFlow.availableCash < ctx.cashFlow.burnRatePerMonth * 3) {
    // already covered by runway risk
  } else if (ctx.cashFlow.availableCash > 0 && ctx.cashFlow.runwayDays > 90 && ctx.cashFlow.availableCash < ctx.cashFlow.burnRatePerMonth * 3) {
    recs.push({
      id: 'rec-build-reserve',
      title: 'Build 3-month emergency cash reserve',
      reason: `Available cash (${inr(ctx.cashFlow.availableCash)}) covers ${Math.round(ctx.cashFlow.availableCash / Math.max(ctx.cashFlow.burnRatePerMonth, 1))} month(s) of burn. Recommend building a 3-month reserve (${inr(ctx.cashFlow.burnRatePerMonth * 3)}) to weather downturns, client losses, or payment delays.`,
      financialImpact: `${inr(ctx.cashFlow.burnRatePerMonth * 3 - ctx.cashFlow.availableCash)} reserve to build`,
      financialImpactValue: ctx.cashFlow.burnRatePerMonth * 3 - ctx.cashFlow.availableCash,
      priority: 'low',
      confidencePct: 85,
      category: 'risk_mitigation',
      actions: [
        'Allocate 10% of monthly revenue to reserve until target hit',
        'Park reserve in liquid fund (6-7% return) not savings account',
        'Review quarterly; rebuild if drawn down',
      ],
      timeframe: '90_days',
    });
  }

  // Sort by priority (critical > high > medium > low) then by financialImpactValue desc
  const priorityOrder: Record<RecommendationPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  recs.sort((a, b) => {
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.financialImpactValue - a.financialImpactValue;
  });

  const totalImpactValue = recs.reduce((s, r) => s + r.financialImpactValue, 0);
  const criticalCount = recs.filter((r) => r.priority === 'critical').length;

  return {
    recommendations: recs,
    totalImpactValue: Math.round(totalImpactValue),
    criticalCount,
    generatedAt: new Date().toISOString(),
  };
}
