// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI CFO™ Phase 1 — BUSINESS RISK ENGINE v2
//
// Automatically detects 10 business risks and assigns Low/Medium/High/Critical:
//   1. Cash Shortage
//   2. Revenue Drop
//   3. Profit Decline
//   4. GST Risk
//   5. ITC Loss
//   6. Customer Concentration
//   7. Vendor Dependency
//   8. Late Payments
//   9. Compliance Risk
//  10. Liquidity Risk
//
// Each risk includes: severity, score (0-100), current state, threshold for
// next severity, financial impact, evidence, and recommendation.
// ═══════════════════════════════════════════════════════════════════════════════

import type { BusinessRiskEngine, BusinessRisk, BusinessRiskType, SeverityLevel } from '../types';
import type { RawCFOData } from './data';
import { now, startOfMonth, startOfLastMonth, endOfLastMonth, addDays, filingDueDate } from './data';
import type { RevenueAnalytics } from '../types';
import type { CashFlowAnalytics } from '../types';
import type { WorkingCapitalAnalytics } from '../types';
import type { ProfitabilityAnalytics } from '../types';

interface RiskContext {
  revenue: RevenueAnalytics;
  cashFlow: CashFlowAnalytics;
  workingCapital: WorkingCapitalAnalytics;
  profitability: ProfitabilityAnalytics;
}

function severityFromScore(score: number): SeverityLevel {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

// ─── Risk 1: Cash Shortage ────────────────────────────────────────────────────
function detectCashShortage(ctx: RiskContext): BusinessRisk {
  const { runwayDays, burnRatePerDay, availableCash } = ctx.cashFlow;
  let score = 10;
  if (runwayDays > 0 && runwayDays <= 15) score = 90;
  else if (runwayDays > 0 && runwayDays <= 30) score = 75;
  else if (runwayDays > 0 && runwayDays <= 60) score = 55;
  else if (runwayDays > 0 && runwayDays <= 90) score = 40;
  else if (availableCash < 100000) score = 65;
  else if (burnRatePerDay > 0 && availableCash < burnRatePerDay * 60) score = 50;
  else score = 15;

  const severity = severityFromScore(score);
  return {
    type: 'cash_shortage',
    label: 'Cash Shortage',
    severity,
    score,
    current: runwayDays > 0
      ? `${runwayDays} days of cash runway remaining (₹${Math.round(availableCash).toLocaleString('en-IN')} available, ₹${burnRatePerDay}/day burn)`
      : `₹${Math.round(availableCash).toLocaleString('en-IN')} available cash, burn rate ₹${burnRatePerDay}/day`,
    threshold: severity === 'critical' ? 'Already critical — immediate action required' : severity === 'high' ? 'Runway < 15 days triggers critical' : severity === 'medium' ? 'Runway < 30 days triggers high' : 'Runway < 60 days triggers medium',
    impact: runwayDays > 0 && runwayDays <= 30
      ? `Business will run out of cash in ${runwayDays} days. Payroll, vendor payments, and GST filings at risk.`
      : 'Cash position under pressure — could impact operations if not addressed.',
    evidence: [
      `Available cash: ₹${Math.round(availableCash).toLocaleString('en-IN')}`,
      `Daily burn rate: ₹${burnRatePerDay}`,
      `Monthly burn: ₹${burnRatePerDay * 30}`,
      `Runway: ${runwayDays > 0 ? runwayDays + ' days' : '> 365 days (healthy)'}`,
    ],
    recommendation: severity === 'critical' || severity === 'high'
      ? 'Recover receivables immediately, delay non-essential spend, consider working capital line of credit.'
      : 'Maintain cash buffer of 60+ days. Monitor burn rate weekly.',
  };
}

// ─── Risk 2: Revenue Drop ─────────────────────────────────────────────────────
function detectRevenueDrop(ctx: RiskContext, data: RawCFOData): BusinessRisk {
  const { growthPct, thisMonth, lastMonth } = ctx.revenue;
  let score = 10;
  if (growthPct <= -25) score = 85;
  else if (growthPct <= -15) score = 70;
  else if (growthPct <= -10) score = 55;
  else if (growthPct <= -5) score = 40;
  else if (growthPct < 0) score = 25;
  else if (growthPct >= 10) score = 8;
  else score = 15;

  const severity = severityFromScore(score);
  return {
    type: 'revenue_drop',
    label: 'Revenue Drop',
    severity,
    score,
    current: `Revenue ${growthPct >= 0 ? 'grew' : 'declined'} ${Math.abs(growthPct).toFixed(1)}% MoM (₹${Math.round(lastMonth).toLocaleString('en-IN')} → ₹${Math.round(thisMonth).toLocaleString('en-IN')})`,
    threshold: severity === 'critical' ? 'Already critical' : severity === 'high' ? 'Drop > 25% triggers critical' : severity === 'medium' ? 'Drop > 15% triggers high' : 'Drop > 10% triggers medium',
    impact: growthPct < -10
      ? `Revenue fell ₹${Math.round(lastMonth - thisMonth).toLocaleString('en-IN')} this month. Sustained decline will compress margins and burn cash.`
      : 'Revenue trend stable or growing.',
    evidence: [
      `This month: ₹${Math.round(thisMonth).toLocaleString('en-IN')}`,
      `Last month: ₹${Math.round(lastMonth).toLocaleString('en-IN')}`,
      `MoM change: ${growthPct.toFixed(1)}%`,
      `${data.invoices.length} total invoices analyzed`,
    ],
    recommendation: growthPct < -10
      ? 'Investigate root cause: lost clients, pricing pressure, or seasonality. Pursue new client acquisition and re-engage dormant accounts.'
      : 'Continue current revenue strategy. Monitor pipeline weekly.',
  };
}

// ─── Risk 3: Profit Decline ───────────────────────────────────────────────────
function detectProfitDecline(ctx: RiskContext): BusinessRisk {
  const { netProfit, netMarginPct, monthlyTrends } = ctx.profitability;
  const lastMonthProfit = monthlyTrends[monthlyTrends.length - 2]?.netProfit || 0;
  const profitChange = lastMonthProfit > 0 ? ((netProfit - lastMonthProfit) / Math.abs(lastMonthProfit)) * 100 : 0;

  let score = 10;
  if (profitChange <= -30) score = 80;
  else if (profitChange <= -15) score = 65;
  else if (profitChange <= -5) score = 45;
  else if (profitChange < 0) score = 30;
  else if (netMarginPct < 5) score = 60;
  else if (netMarginPct < 10) score = 35;
  else score = 12;

  const severity = severityFromScore(score);
  return {
    type: 'profit_decline',
    label: 'Profit Decline',
    severity,
    score,
    current: `Net profit ₹${Math.round(netProfit).toLocaleString('en-IN')} (${netMarginPct}% margin), ${profitChange >= 0 ? '+' : ''}${profitChange.toFixed(1)}% vs last month`,
    threshold: severity === 'critical' ? 'Already critical' : severity === 'high' ? 'Decline > 30% triggers critical' : severity === 'medium' ? 'Decline > 15% triggers high' : 'Margin < 5% triggers high',
    impact: profitChange < -15
      ? `Profit fell ₹${Math.round(Math.abs(lastMonthProfit - netProfit)).toLocaleString('en-IN')}. Sustained decline threatens business viability.`
      : `Net margin at ${netMarginPct}%. ${netMarginPct < 10 ? 'Below healthy threshold.' : 'Within healthy range.'}`,
    evidence: [
      `Current net profit: ₹${Math.round(netProfit).toLocaleString('en-IN')}`,
      `Net margin: ${netMarginPct}%`,
      `Last month profit: ₹${Math.round(lastMonthProfit).toLocaleString('en-IN')}`,
      `Change: ${profitChange.toFixed(1)}%`,
    ],
    recommendation: profitChange < -10 || netMarginPct < 10
      ? 'Reduce discretionary spend. Review pricing. Renegotiate vendor contracts. Focus on high-margin clients.'
      : 'Profitability healthy. Maintain cost discipline.',
  };
}

// ─── Risk 4: GST Risk ─────────────────────────────────────────────────────────
function detectGSTRisk(data: RawCFOData): BusinessRisk {
  const today = now();
  const overdueFilings = data.filings.filter((f) => {
    if (f.status === 'filed') return false;
    const due = filingDueDate(f.returnType, f.period);
    return due ? due < today : false;
  });
  const pendingFilings = data.filings.filter((f) => f.status !== 'filed');
  const penaltyNotices = data.notices.filter((n) => {
    const t = (n.noticeType || '').toLowerCase();
    return t.includes('penalty') || t.includes('fine') || t.includes('interest') || t.includes('demand');
  });

  let score = 10;
  if (penaltyNotices.length > 0) score = 85;
  else if (overdueFilings.length >= 3) score = 75;
  else if (overdueFilings.length >= 1) score = 60;
  else if (pendingFilings.length >= 5) score = 45;
  else if (pendingFilings.length >= 1) score = 30;
  else score = 8;

  const severity = severityFromScore(score);
  return {
    type: 'gst_risk',
    label: 'GST Risk',
    severity,
    score,
    current: `${overdueFilings.length} overdue filing(s), ${pendingFilings.length} pending, ${penaltyNotices.length} penalty notice(s)`,
    threshold: severity === 'critical' ? 'Already critical' : severity === 'high' ? 'Penalty notice triggers critical' : severity === 'medium' ? '3+ overdue filings triggers high' : '1+ overdue filing triggers medium',
    impact: penaltyNotices.length > 0
      ? `${penaltyNotices.length} GST notice(s) with penalty demand. ₹50/day late fee + 18% p.a. interest accruing. ITC may be blocked.`
      : overdueFilings.length > 0
      ? `${overdueFilings.length} overdue return(s). Late fee ₹50/day + 18% p.a. interest accruing. ITC at risk.`
      : 'GST compliance on track.',
    evidence: [
      `Overdue filings: ${overdueFilings.length}`,
      `Pending filings: ${pendingFilings.length}`,
      `Penalty notices: ${penaltyNotices.length}`,
      `Total notices: ${data.notices.length}`,
    ],
    recommendation: overdueFilings.length > 0 || penaltyNotices.length > 0
      ? 'File overdue returns immediately. Respond to notices within 15 days. Set up auto-reminders 5 days before due dates.'
      : 'Maintain current filing cadence. Monitor upcoming due dates.',
  };
}

// ─── Risk 5: ITC Loss ─────────────────────────────────────────────────────────
function detectITCLoss(data: RawCFOData): BusinessRisk {
  const today = now();
  const totalITC = data.purchaseBills.reduce((s, p) => s + (p.gstAmount || (p.cgst + p.sgst + p.igst + p.cess)), 0);
  // ITC at risk: purchase bills older than 180 days where ITC not yet claimed
  // (Section 16(4) of CGST Act — must claim ITC by 30th Nov of following FY)
  const itcAtRisk = data.purchaseBills
    .filter((p) => {
      const d = new Date(p.invoiceDate);
      const age = (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
      return age > 180 && p.paymentStatus !== 'paid';
    })
    .reduce((s, p) => s + (p.gstAmount || (p.cgst + p.sgst + p.igst + p.cess)), 0);

  // ITC reversal risk: vendor invoices where vendor GSTR-1 not matched (rule 37)
  const unmatchedVendorBills = data.purchaseBills.filter((p) => !p.vendorGstin).length;

  let score = 8;
  if (itcAtRisk > 500000) score = 75;
  else if (itcAtRisk > 100000) score = 55;
  else if (itcAtRisk > 0) score = 40;
  else if (unmatchedVendorBills > 5) score = 35;
  else score = 10;

  const severity = severityFromScore(score);
  return {
    type: 'itc_loss',
    label: 'ITC Loss',
    severity,
    score,
    current: `₹${Math.round(totalITC).toLocaleString('en-IN')} total ITC available, ₹${Math.round(itcAtRisk).toLocaleString('en-IN')} at risk of expiry`,
    threshold: severity === 'critical' ? 'Already critical' : severity === 'high' ? 'ITC at risk > ₹5L triggers critical' : severity === 'medium' ? 'ITC at risk > ₹1L triggers high' : 'Any ITC at risk triggers medium',
    impact: itcAtRisk > 0
      ? `₹${Math.round(itcAtRisk).toLocaleString('en-IN')} of input tax credit may lapse if not claimed within statutory timeline. This is direct cash loss.`
      : 'ITC position healthy — no immediate expiry risk.',
    evidence: [
      `Total ITC available: ₹${Math.round(totalITC).toLocaleString('en-IN')}`,
      `ITC at risk (>180 days): ₹${Math.round(itcAtRisk).toLocaleString('en-IN')}`,
      `Unmatched vendor bills: ${unmatchedVendorBills}`,
      `${data.purchaseBills.length} total purchase bills`,
    ],
    recommendation: itcAtRisk > 0
      ? 'Reconcile GSTR-2B vs purchase register immediately. Claim eligible ITC in next GSTR-3B filing. Follow up with vendors for unmatched invoices.'
      : 'Maintain monthly GSTR-2B reconciliation. Track ITC aging weekly.',
  };
}

// ─── Risk 6: Customer Concentration ──────────────────────────────────────────
function detectCustomerConcentration(ctx: RiskContext): BusinessRisk {
  const { byClient } = ctx.revenue;
  const totalRevenue = byClient.reduce((s, c) => s + c.revenue, 0);
  const topClient = byClient[0];
  const top3Share = byClient.slice(0, 3).reduce((s, c) => s + c.sharePct, 0);

  let score = 10;
  if (topClient && topClient.sharePct >= 50) score = 80;
  else if (topClient && topClient.sharePct >= 35) score = 65;
  else if (top3Share >= 70) score = 60;
  else if (topClient && topClient.sharePct >= 25) score = 45;
  else if (top3Share >= 50) score = 35;
  else score = 12;

  const severity = severityFromScore(score);
  return {
    type: 'customer_concentration',
    label: 'Customer Concentration',
    severity,
    score,
    current: topClient
      ? `Top client "${topClient.clientName}" = ${topClient.sharePct}% of revenue. Top 3 = ${top3Share.toFixed(1)}%.`
      : 'No revenue data to assess concentration.',
    threshold: severity === 'critical' ? 'Already critical' : severity === 'high' ? 'Single client > 50% triggers critical' : severity === 'medium' ? 'Single client > 35% triggers high' : 'Top 3 > 70% triggers medium',
    impact: topClient && topClient.sharePct >= 35
      ? `Losing "${topClient.clientName}" would reduce revenue by ${topClient.sharePct}%. High concentration = high vulnerability.`
      : 'Client base is reasonably diversified.',
    evidence: [
      `Top client share: ${topClient?.sharePct.toFixed(1) || 0}%`,
      `Top 3 client share: ${top3Share.toFixed(1)}%`,
      `Total active clients: ${byClient.length}`,
      `Total revenue: ₹${Math.round(totalRevenue).toLocaleString('en-IN')}`,
    ],
    recommendation: topClient && topClient.sharePct >= 35
      ? 'Diversify client base aggressively. Target new accounts in adjacent verticals. Negotiate multi-year contracts with top clients to reduce churn risk.'
      : 'Continue diversification. Maintain 15% max share per client as a guideline.',
  };
}

// ─── Risk 7: Vendor Dependency ────────────────────────────────────────────────
function detectVendorDependency(data: RawCFOData): BusinessRisk {
  const vendorAgg = new Map<string, { spend: number; name: string }>();
  for (const p of data.purchaseBills) {
    const key = p.vendorGstin || p.vendorName;
    const existing = vendorAgg.get(key) || { spend: 0, name: p.vendorName };
    existing.spend += p.totalAmount || 0;
    vendorAgg.set(key, existing);
  }
  const totalSpend = Array.from(vendorAgg.values()).reduce((s, v) => s + v.spend, 0);
  const sortedVendors = Array.from(vendorAgg.entries())
    .map(([k, v]) => ({ key: k, name: v.name, spend: v.spend, share: totalSpend > 0 ? (v.spend / totalSpend) * 100 : 0 }))
    .sort((a, b) => b.spend - a.spend);
  const topVendor = sortedVendors[0];
  const top3Share = sortedVendors.slice(0, 3).reduce((s, v) => s + v.share, 0);

  let score = 8;
  if (topVendor && topVendor.share >= 60) score = 70;
  else if (topVendor && topVendor.share >= 40) score = 55;
  else if (top3Share >= 80) score = 50;
  else if (topVendor && topVendor.share >= 25) score = 35;
  else score = 10;

  const severity = severityFromScore(score);
  return {
    type: 'vendor_dependency',
    label: 'Vendor Dependency',
    severity,
    score,
    current: topVendor
      ? `Top vendor "${topVendor.name}" = ${topVendor.share.toFixed(1)}% of spend. Top 3 = ${top3Share.toFixed(1)}%.`
      : 'No vendor spend data.',
    threshold: severity === 'critical' ? 'Already critical' : severity === 'high' ? 'Single vendor > 60% triggers critical' : severity === 'medium' ? 'Single vendor > 40% triggers high' : 'Top 3 > 80% triggers medium',
    impact: topVendor && topVendor.share >= 40
      ? `Disruption from "${topVendor.name}" would impact ${topVendor.share.toFixed(1)}% of procurement. Single point of failure.`
      : 'Vendor base reasonably diversified.',
    evidence: [
      `Top vendor share: ${topVendor?.share.toFixed(1) || 0}%`,
      `Top 3 vendor share: ${top3Share.toFixed(1)}%`,
      `Total vendors: ${sortedVendors.length}`,
      `Total spend: ₹${Math.round(totalSpend).toLocaleString('en-IN')}`,
    ],
    recommendation: topVendor && topVendor.share >= 40
      ? 'Onboard backup vendors for critical categories. Negotiate multi-source contracts. Maintain 30% max share per vendor.'
      : 'Maintain current vendor diversification. Monitor pricing competitiveness.',
  };
}

// ─── Risk 8: Late Payments ────────────────────────────────────────────────────
function detectLatePayments(data: RawCFOData): BusinessRisk {
  const today = now();
  const overdueInvoices = data.invoices.filter((i) => {
    if (i.paymentStatus === 'paid') return false;
    if (i.dueDate && new Date(i.dueDate) < today) return true;
    return i.paymentStatus === 'overdue';
  });
  const overdueAmount = overdueInvoices.reduce((s, i) => s + (i.balanceAmount || i.totalAmount || 0), 0);
  const totalReceivables = data.invoices
    .filter((i) => i.paymentStatus !== 'paid')
    .reduce((s, i) => s + (i.balanceAmount || i.totalAmount || 0), 0);

  let score = 10;
  if (overdueInvoices.length > 10 || overdueAmount > 1000000) score = 75;
  else if (overdueInvoices.length > 5 || overdueAmount > 500000) score = 60;
  else if (overdueInvoices.length > 2 || overdueAmount > 100000) score = 45;
  else if (overdueInvoices.length > 0) score = 30;
  else score = 8;

  const severity = severityFromScore(score);
  return {
    type: 'late_payments',
    label: 'Late Payments',
    severity,
    score,
    current: `${overdueInvoices.length} overdue invoice(s), ₹${Math.round(overdueAmount).toLocaleString('en-IN')} stuck in receivables`,
    threshold: severity === 'critical' ? 'Already critical' : severity === 'high' ? '> 10 overdue or > ₹10L triggers critical' : severity === 'medium' ? '> 5 overdue or > ₹5L triggers high' : '> 2 overdue triggers medium',
    impact: overdueAmount > 0
      ? `₹${Math.round(overdueAmount).toLocaleString('en-IN')} tied up in overdue receivables — ${Math.round(totalReceivables > 0 ? (overdueAmount / totalReceivables) * 100 : 0)}% of total receivables. Cash flow impact direct.`
      : 'Receivables healthy — no overdue invoices.',
    evidence: [
      `Overdue invoices: ${overdueInvoices.length}`,
      `Overdue amount: ₹${Math.round(overdueAmount).toLocaleString('en-IN')}`,
      `Total receivables: ₹${Math.round(totalReceivables).toLocaleString('en-IN')}`,
      `Overdue as % of receivables: ${Math.round(totalReceivables > 0 ? (overdueAmount / totalReceivables) * 100 : 0)}%`,
    ],
    recommendation: overdueInvoices.length > 0
      ? 'Send WhatsApp reminders to all overdue clients today. Escalate after 30 days. Consider 1% early-payment discount. Tighten credit terms for repeat offenders.'
      : 'Maintain current reminder cadence. Monitor DSO weekly.',
  };
}

// ─── Risk 9: Compliance Risk ──────────────────────────────────────────────────
function detectComplianceRisk(data: RawCFOData): BusinessRisk {
  const today = now();
  const openNotices = data.notices.filter((n) => n.status === 'open' || n.status === 'pending');
  const overdueNotices = openNotices.filter((n) => n.dueDate && new Date(n.dueDate) < today);
  const pendingFilings = data.filings.filter((f) => f.status !== 'filed');
  const overdueFilings = pendingFilings.filter((f) => {
    const due = filingDueDate(f.returnType, f.period);
    return due ? due < today : false;
  });

  let score = 10;
  if (overdueNotices.length > 0) score = 85;
  else if (overdueFilings.length >= 3) score = 70;
  else if (overdueFilings.length >= 1) score = 55;
  else if (openNotices.length > 3) score = 50;
  else if (openNotices.length > 0) score = 35;
  else if (pendingFilings.length > 5) score = 30;
  else score = 10;

  const severity = severityFromScore(score);
  return {
    type: 'compliance_risk',
    label: 'Compliance Risk',
    severity,
    score,
    current: `${overdueFilings.length} overdue filing(s), ${openNotices.length} open notice(s), ${overdueNotices.length} overdue notice(s)`,
    threshold: severity === 'critical' ? 'Already critical' : severity === 'high' ? 'Overdue notice triggers critical' : severity === 'medium' ? '3+ overdue filings triggers high' : 'Open notice triggers medium',
    impact: overdueNotices.length > 0
      ? `${overdueNotices.length} overdue GST notice(s) — non-response can trigger penalty + assessment proceedings + ITC block.`
      : overdueFilings.length > 0
      ? `${overdueFilings.length} overdue return(s) — late fee + interest accruing daily.`
      : 'Compliance position healthy.',
    evidence: [
      `Open notices: ${openNotices.length}`,
      `Overdue notices: ${overdueNotices.length}`,
      `Pending filings: ${pendingFilings.length}`,
      `Overdue filings: ${overdueFilings.length}`,
    ],
    recommendation: overdueNotices.length > 0
      ? 'Respond to overdue notices within 7 days. Engage CA if needed. File overdue returns immediately. Implement compliance calendar with auto-reminders.'
      : 'Maintain current compliance cadence. Audit filing calendar monthly.',
  };
}

// ─── Risk 10: Liquidity Risk ──────────────────────────────────────────────────
function detectLiquidityRisk(ctx: RiskContext): BusinessRisk {
  const { workingCapitalRatio, quickRatio, currentAssets, currentLiabilities, liquidityRisk } = ctx.workingCapital;
  // Note: workingCapitalRatio === 999 is a sentinel meaning "no current liabilities"
  // (very healthy). Treat as low risk.
  let score = 10;
  if (workingCapitalRatio === 999) {
    score = 8;
  } else if (workingCapitalRatio < 0.5) {
    score = 85;
  } else if (workingCapitalRatio < 0.8) {
    score = 70;
  } else if (workingCapitalRatio < 1.0) {
    score = 55;
  } else if (workingCapitalRatio < 1.2) {
    score = 40;
  } else if (workingCapitalRatio > 3) {
    score = 15;
  } else {
    score = 12;
  }

  const severity = severityFromScore(score);
  const ratioDisplay = workingCapitalRatio === 999 ? '∞ (no current liabilities)' : workingCapitalRatio.toFixed(2);
  const quickDisplay = quickRatio === 999 ? '∞' : quickRatio.toFixed(2);
  return {
    type: 'liquidity_risk',
    label: 'Liquidity Risk',
    severity,
    score,
    current: `Working capital ratio ${ratioDisplay}, quick ratio ${quickDisplay}, CA ₹${Math.round(currentAssets).toLocaleString('en-IN')} vs CL ₹${Math.round(currentLiabilities).toLocaleString('en-IN')}`,
    threshold: severity === 'critical' ? 'Already critical' : severity === 'high' ? 'Ratio < 0.5 triggers critical' : severity === 'medium' ? 'Ratio < 0.8 triggers high' : 'Ratio < 1.0 triggers medium',
    impact: workingCapitalRatio === 999
      ? `No current liabilities — current assets of ₹${Math.round(currentAssets).toLocaleString('en-IN')} are unencumbered. Very healthy liquidity.`
      : workingCapitalRatio < 1.0
      ? `Current liabilities exceed current assets by ₹${Math.round(currentLiabilities - currentAssets).toLocaleString('en-IN')}. Business cannot meet short-term obligations from current assets alone.`
      : 'Liquidity position adequate.',
    evidence: [
      `Working capital ratio: ${ratioDisplay}`,
      `Quick ratio: ${quickDisplay}`,
      `Current assets: ₹${Math.round(currentAssets).toLocaleString('en-IN')}`,
      `Current liabilities: ₹${Math.round(currentLiabilities).toLocaleString('en-IN')}`,
    ],
    recommendation: workingCapitalRatio === 999
      ? 'No current liabilities — maintain this position. Deploy excess cash for growth or park in liquid funds.'
      : workingCapitalRatio < 1.0
      ? 'Accelerate receivables collection. Negotiate extended payment terms with vendors. Arrange short-term working capital facility. Defer non-essential capex.'
      : 'Maintain working capital ratio above 1.5. Deploy excess cash for growth.',
  };
}

export function computeRiskEngine(data: RawCFOData, ctx: RiskContext): BusinessRiskEngine {
  const risks: BusinessRisk[] = [
    detectCashShortage(ctx),
    detectRevenueDrop(ctx, data),
    detectProfitDecline(ctx),
    detectGSTRisk(data),
    detectITCLoss(data),
    detectCustomerConcentration(ctx),
    detectVendorDependency(data),
    detectLatePayments(data),
    detectComplianceRisk(data),
    detectLiquidityRisk(ctx),
  ];

  // Sort by score desc
  risks.sort((a, b) => b.score - a.score);

  const overallRiskScore = Math.round(risks.reduce((s, r) => s + r.score, 0) / risks.length);
  const overallRiskLevel: SeverityLevel =
    risks.some((r) => r.severity === 'critical') ? 'critical'
    : risks.some((r) => r.severity === 'high') ? 'high'
    : risks.some((r) => r.severity === 'medium') ? 'medium'
    : 'low';

  const criticalCount = risks.filter((r) => r.severity === 'critical').length;
  const highCount = risks.filter((r) => r.severity === 'high').length;

  return {
    risks,
    overallRiskLevel,
    overallRiskScore,
    criticalCount,
    highCount,
    generatedAt: new Date().toISOString(),
  };
}
