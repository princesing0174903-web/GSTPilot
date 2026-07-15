// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Intelligence Engine — Cashflow Analyzer
//
// Combines banking + invoices data to detect cash position problems and
// collection opportunities. Emits signals like "negative balance", "negative
// 30-day flow", "low runway", and "collections could cover the gap".
// ═══════════════════════════════════════════════════════════════════════════════

import type { Analyzer, AnalyzerResult, Signal } from '../types';
import { getDataset } from '../types';
import type { BankingData, InvoicesData } from '../types';

/**
 * Estimate how many days the current cash position can sustain the recent
 * burn rate. Returns Infinity if burn is non-positive.
 */
function runwayDays(totalBalance: number, netFlow30d: number): number {
  if (netFlow30d >= 0) return Number.POSITIVE_INFINITY;
  const dailyBurn = Math.abs(netFlow30d) / 30;
  return totalBalance / dailyBurn;
}

export const cashflowAnalyzer: Analyzer = {
  id: 'cashflow',
  label: 'Cash Flow',
  analyze(dataset): AnalyzerResult {
    const signals: Signal[] = [];
    const metrics: Record<string, number> = {};

    const banking = getDataset<BankingData>(dataset, 'banking');
    const invoices = getDataset<InvoicesData>(dataset, 'invoices');

    // ── Metrics (always computed, even if disconnected) ──────────────────────
    const totalBalance = banking?.totals.totalBalance ?? 0;
    const availableBalance = banking?.totals.availableBalance ?? 0;
    const netFlow30d = banking?.totals.netFlow ?? 0;
    const recentCredits = banking?.totals.recentCredits ?? 0;
    const recentDebits = banking?.totals.recentDebits ?? 0;
    const salesOutstanding = invoices?.totals.salesOutstanding ?? 0;
    const purchaseOutstanding = invoices?.totals.purchaseOutstanding ?? 0;
    const overdueAmount = invoices?.totals.overdueAmount ?? 0;

    metrics.totalCash = totalBalance;
    metrics.availableCash = availableBalance;
    metrics.netFlow30d = netFlow30d;
    metrics.recentCredits30d = recentCredits;
    metrics.recentDebits30d = recentDebits;
    metrics.salesOutstanding = salesOutstanding;
    metrics.purchaseOutstanding = purchaseOutstanding;
    metrics.runwayDays = Number.isFinite(runwayDays(totalBalance, netFlow30d))
      ? runwayDays(totalBalance, netFlow30d)
      : 999;

    // ── Problem: negative balance ───────────────────────────────────────────
    if (banking && totalBalance < 0) {
      signals.push({
        id: 'cashflow:negative-balance',
        kind: 'problem',
        category: 'cashflow',
        severity: 'critical',
        title: 'Bank balance is negative',
        description: `Total balance across connected accounts is ₹${Math.abs(totalBalance).toLocaleString('en-IN')} below zero. Overdraft or unauthorised transactions may be accruing interest.`,
        recommendation: 'Transfer funds or arrange an overdraft facility immediately to restore a positive balance.',
        monetaryValue: Math.abs(totalBalance),
        dueDate: null,
        confidence: 0.95,
        evidence: banking.accounts.slice(0, 3).map((a) => ({
          source: 'banking',
          reference: `${a.bankName} ${a.accountMasked}`,
        })),
        analyzer: 'cashflow',
        tags: { accountCount: banking.accounts.length },
      });
    }

    // ── Problem: negative 30-day net flow ───────────────────────────────────
    if (banking && netFlow30d < 0) {
      const days = runwayDays(totalBalance, netFlow30d);
      const severity = Number.isFinite(days) && days < 14 ? 'high' : 'medium';
      signals.push({
        id: 'cashflow:negative-netflow',
        kind: 'problem',
        category: 'cashflow',
        severity,
        title: 'Cash outflow exceeds inflow over last 30 days',
        description: `Net cash flow in the last 30 days is -₹${Math.abs(netFlow30d).toLocaleString('en-IN')}. At the current burn rate, the cash position covers approximately ${Number.isFinite(days) ? Math.round(days) : '∞'} days of operations.`,
        recommendation:
          'Review top debit categories and defer non-essential spend. Accelerate receivables collection to reverse the trend.',
        monetaryValue: Math.abs(netFlow30d),
        dueDate: null,
        confidence: 0.85,
        evidence: [{ source: 'banking', reference: 'Bank transactions (last 30 days)' }],
        analyzer: 'cashflow',
        tags: { recentCredits, recentDebits },
      });
    }

    // ── Problem: low runway ─────────────────────────────────────────────────
    const runway = runwayDays(totalBalance, netFlow30d);
    if (banking && Number.isFinite(runway) && runway < 14 && totalBalance >= 0) {
      signals.push({
        id: 'cashflow:low-runway',
        kind: 'problem',
        category: 'cashflow',
        severity: runway < 7 ? 'critical' : 'high',
        title: 'Cash runway under 2 weeks',
        description: `At the current 30-day burn rate, available cash (₹${totalBalance.toLocaleString('en-IN')}) covers roughly ${Math.round(runway)} days of outflow.`,
        recommendation: 'Arrange a working-capital line or accelerate collections immediately.',
        monetaryValue: totalBalance,
        dueDate: null,
        confidence: 0.8,
        evidence: [{ source: 'banking', reference: 'Cash position vs 30-day burn' }],
        analyzer: 'cashflow',
      });
    }

    // ── Opportunity: collections could cover the gap ────────────────────────
    if (invoices && salesOutstanding > 0 && (netFlow30d < 0 || totalBalance < salesOutstanding * 0.5)) {
      signals.push({
        id: 'cashflow:collect-to-cover-gap',
        kind: 'opportunity',
        category: 'receivables',
        severity: 'high',
        title: 'Outstanding receivables can restore cash position',
        description: `₹${salesOutstanding.toLocaleString('en-IN')} in sales receivables is outstanding. Collecting even 30% would meaningfully improve the cash position.`,
        recommendation: 'Trigger payment reminders for the top 5 overdue invoices today.',
        monetaryValue: salesOutstanding * 0.3,
        dueDate: null,
        confidence: 0.8,
        evidence: [{ source: 'invoices', reference: `${invoices.invoices.length} sales invoices` }],
        analyzer: 'cashflow',
      });
    }

    // ── Problem: large payables coming due ──────────────────────────────────
    if (invoices && purchaseOutstanding > 0 && purchaseOutstanding > totalBalance) {
      signals.push({
        id: 'cashflow:payables-exceed-cash',
        kind: 'problem',
        category: 'payables',
        severity: 'high',
        title: 'Vendor payables exceed available cash',
        description: `Outstanding vendor payables (₹${purchaseOutstanding.toLocaleString('en-IN')}) exceed the current cash position (₹${totalBalance.toLocaleString('en-IN')}). Some bills may need renegotiation or staging.`,
        recommendation: 'Negotiate payment terms with the top 3 vendors, or prioritise payments by criticality.',
        monetaryValue: purchaseOutstanding - totalBalance,
        dueDate: null,
        confidence: 0.75,
        evidence: [{ source: 'invoices', reference: `${invoices.purchaseBills.length} purchase bills` }],
        analyzer: 'cashflow',
      });
    }

    // ── Info: positive inflow ───────────────────────────────────────────────
    if (banking && netFlow30d > 0 && recentCredits > 0) {
      signals.push({
        id: 'cashflow:positive-inflow',
        kind: 'info',
        category: 'cashflow',
        severity: 'low',
        title: 'Positive cash inflow this period',
        description: `Net cash flow over the last 30 days is +₹${netFlow30d.toLocaleString('en-IN')} (inflow ₹${recentCredits.toLocaleString('en-IN')} vs outflow ₹${recentDebits.toLocaleString('en-IN')}).`,
        recommendation: 'Consider parking surplus in a sweep or short-term deposit for yield.',
        monetaryValue: netFlow30d,
        dueDate: null,
        confidence: 0.8,
        evidence: [{ source: 'banking', reference: 'Bank transactions (last 30 days)' }],
        analyzer: 'cashflow',
      });
    }

    // ── Info: overdue receivables pressure ──────────────────────────────────
    if (invoices && overdueAmount > 0) {
      signals.push({
        id: 'cashflow:overdue-pressure',
        kind: 'problem',
        category: 'receivables',
        severity: overdueAmount > salesOutstanding * 0.5 ? 'high' : 'medium',
        title: `${invoices.invoices.filter((i) => i.paymentStatus === 'overdue').length} invoices are overdue`,
        description: `₹${overdueAmount.toLocaleString('en-IN')} in receivables is past the due date. Each overdue day increases the probability of default.`,
        recommendation: 'Send tiered reminders (gentle → firm → legal) starting today.',
        monetaryValue: overdueAmount,
        dueDate: null,
        confidence: 0.9,
        evidence: [{ source: 'invoices', reference: 'Overdue sales invoices' }],
        analyzer: 'cashflow',
      });
    }

    return { analyzer: 'cashflow', signals, metrics };
  },
};
