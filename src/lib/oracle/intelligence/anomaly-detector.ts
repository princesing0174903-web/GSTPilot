// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Intelligence Module: Anomaly Detector
// ═══════════════════════════════════════════════════════════════════════════════
//
// Detects business anomalies using STATISTICAL + BUSINESS RULES — NOT the LLM.
// The Oracle brain never invents anomaly detection; it only reasons about
// anomalies this module has already flagged.
//
// PRINCIPLES:
//   1. PURE FUNCTIONS (one exception: a read-only Prisma query for duplicate
//      invoice detection — never writes).
//   2. REAL DATA ONLY. Reads from the UnifiedOracleContext. If the underlying
//      numbers are zero / empty, the rule simply does not fire. NEVER fabricates.
//   3. EVERY anomaly cites an evidenceId from ctx.evidenceIndex so the UI can
//      render a click-through source card and the LLM can quote provenance.
//   4. CONFIDENCE-AWARE. `hasSufficientData: false` when the underlying series
//      has fewer than 3 data points. The LLM must be told when confidence is low.
//   5. SORTED by severity (critical → low) so the most urgent anomalies surface
//      first in the daily briefing.
//
// INPUT: a fully-built UnifiedOracleContext (see context/builder.ts).
// OUTPUT: a sorted array of Anomaly records (empty array if none — never null).
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { UnifiedOracleContext } from '../context/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Anomaly {
  id: string;
  kind:
    | 'revenue_spike'
    | 'revenue_drop'
    | 'expense_spike'
    | 'overdue_spike'
    | 'customer_concentration'
    | 'cash_decline'
    | 'duplicate_invoice'
    | 'gst_mismatch'
    | 'missing_gstr2b'
    | 'supplier_compliance'
    | 'payment_delay_pattern'
    | 'suspicious_transaction'
    | 'sudden_expense_growth';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  detail: string;
  /** The metric value that triggered the anomaly. */
  observedValue: number;
  /** The expected baseline (if computable). */
  expectedValue?: number;
  /** ₹ impact if applicable. */
  estimatedImpact?: number;
  /** Evidence backing this anomaly (from ctx.evidenceIndex). */
  evidenceId: string;
  /** Recommended action. */
  recommendedAction: string;
  /** Whether this anomaly is based on sufficient data (false = low confidence). */
  hasSufficientData: boolean;
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Detect business anomalies from the Unified Oracle Context.
 *
 * ASYNC because the duplicate-invoice rule (rule 6) performs a read-only
 * Prisma query. The function has NO side effects — it never writes to the DB.
 *
 * @returns Sorted array of anomalies (critical → low). Empty array if none.
 *          NEVER returns null and NEVER fabricates anomalies.
 */
export async function detectAnomalies(ctx: UnifiedOracleContext): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  // Statistical rules
  detectRevenueSpikeOrDrop(ctx, anomalies);
  detectExpenseSpike(ctx, anomalies);
  detectSuddenExpenseGrowth(ctx, anomalies);
  detectOverdueSpike(ctx, anomalies);
  detectCustomerConcentration(ctx, anomalies);
  detectCashDecline(ctx, anomalies);
  detectGstMismatch(ctx, anomalies);
  detectMissingGstr2b(ctx, anomalies);
  detectSupplierCompliance(ctx, anomalies);
  detectPaymentDelayPattern(ctx, anomalies);
  detectSuspiciousTransaction(ctx, anomalies);

  // DB-backed rule (read-only)
  await detectDuplicateInvoice(ctx, anomalies);

  // Sort: critical → low. Stable on kind within a severity band.
  return anomalies.sort(bySeverity);
}

// ─── Stat helpers ─────────────────────────────────────────────────────────────

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Sample standard deviation (n-1 denominator). 0 if fewer than 2 data points. */
function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

const SEVERITY_ORDER: Record<Anomaly['severity'], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function bySeverity(a: Anomaly, b: Anomaly): number {
  return SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
}

function inr(n: number): string {
  const rounded = Math.round(n);
  return `₹${rounded.toLocaleString('en-IN')}`;
}

/**
 * Pick a valid evidenceId from ctx.evidenceIndex, preferring the most specific
 * source. Falls back to a related index entry when the preferred ID is not in
 * the index (e.g. `customers` is on ctx.customers.evidence but not in the
 * index — fall back to `invoices-fy`, which is in the index).
 */
function pickEvidenceId(
  ctx: UnifiedOracleContext,
  preferred: string,
  fallback: string,
): string {
  if (ctx.evidenceIndex[preferred]) return preferred;
  if (ctx.evidenceIndex[fallback]) return fallback;
  // If neither is in the index (e.g. empty/demo context), still cite the
  // most semantically relevant id — UI may render a generic source card.
  return preferred;
}

// ─── Rule 1: Revenue spike / drop ─────────────────────────────────────────────
// If monthlySeries has ≥3 months, compute mean + stddev. Flag if the latest
// month is >2 stddev above (spike) or below (drop) the mean.

function detectRevenueSpikeOrDrop(ctx: UnifiedOracleContext, out: Anomaly[]): void {
  const series = ctx.revenue.monthlySeries;
  if (series.length < 3) return; // need at least 3 months to compute stats

  const values = series.map(s => s.value);
  const m = mean(values);
  const sd = stddev(values);
  const latest = values[values.length - 1];
  const latestMonth = series[series.length - 1]?.month ?? 'latest month';

  // Avoid false positives when there's no variance (sd === 0).
  if (sd <= 0) return;

  const upper = m + 2 * sd;
  const lower = m - 2 * sd;

  // ≥6 months = high confidence per the forecaster's confidence ladder.
  const hasSufficientData = series.length >= 6;
  const evidenceId = ctx.revenue.evidence.id;

  if (latest > upper) {
    out.push({
      id: `revenue-spike-${series.length}-${Math.round(latest)}`,
      kind: 'revenue_spike',
      severity: 'high',
      title: `Revenue spike in ${latestMonth} (${inr(latest)})`,
      detail: `Revenue of ${inr(latest)} in ${latestMonth} is more than 2 standard deviations above the ${series.length}-month mean (${inr(m)}, σ=${inr(sd)}). This is statistically unusual — verify the underlying invoices are legitimate and not duplicates or back-dated entries.`,
      observedValue: latest,
      expectedValue: m,
      estimatedImpact: latest - m,
      evidenceId: pickEvidenceId(ctx, evidenceId, 'invoices-fy'),
      recommendedAction: `Audit the invoices raised in ${latestMonth}. Confirm the spike reflects real billings and not a data-entry error or duplicate.`,
      hasSufficientData,
    });
  } else if (latest < lower) {
    out.push({
      id: `revenue-drop-${series.length}-${Math.round(latest)}`,
      kind: 'revenue_drop',
      severity: 'high',
      title: `Revenue drop in ${latestMonth} (${inr(latest)})`,
      detail: `Revenue of ${inr(latest)} in ${latestMonth} is more than 2 standard deviations below the ${series.length}-month mean (${inr(m)}, σ=${inr(sd)}). This could signal a lost customer, a billing pause, or pipeline slippage.`,
      observedValue: latest,
      expectedValue: m,
      estimatedImpact: m - latest,
      evidenceId: pickEvidenceId(ctx, evidenceId, 'invoices-fy'),
      recommendedAction: `Identify which customers did not bill this month vs last. Re-engage stalled deals and confirm no invoices are missing from the books.`,
      hasSufficientData,
    });
  }
}

// ─── Rule 2: Expense spike (50% MoM increase) ─────────────────────────────────
// If expenses.trend.thisMonth > expenses.trend.lastMonth * 1.5 — flag.

function detectExpenseSpike(ctx: UnifiedOracleContext, out: Anomaly[]): void {
  const { thisMonth, lastMonth } = ctx.expenses.trend;
  // Avoid divide-by-zero / false positives on placeholder zeros.
  if (lastMonth <= 0) return;
  if (thisMonth > lastMonth * 1.5) {
    const pctIncrease = ((thisMonth - lastMonth) / lastMonth) * 100;
    out.push({
      id: `expense-spike-${Math.round(thisMonth)}`,
      kind: 'expense_spike',
      severity: 'medium',
      title: `Expense spike: ${pctIncrease.toFixed(0)}% MoM increase`,
      detail: `Operating expenses this month (${inr(thisMonth)}) are ${pctIncrease.toFixed(0)}% higher than last month (${inr(lastMonth)}). Verify the increase is justified by business activity and not a mis-categorised entry.`,
      observedValue: thisMonth,
      expectedValue: lastMonth,
      estimatedImpact: thisMonth - lastMonth,
      evidenceId: pickEvidenceId(ctx, ctx.expenses.evidence.id, 'expenses-fy'),
      recommendedAction: 'Break down the month-over-month delta by category. Confirm large one-off expenses are legitimate and recurring expenses are not creeping up.',
      hasSufficientData: true,
    });
  }
}

// ─── Rule 3: Overdue spike (>50% of outstanding is overdue) ───────────────────
// If invoices.overdue > invoices.outstanding * 0.5 — flag.

function detectOverdueSpike(ctx: UnifiedOracleContext, out: Anomaly[]): void {
  const outstanding = ctx.invoices.outstanding;
  const overdue = ctx.invoices.overdue;
  if (outstanding <= 0) return;
  const ratio = overdue / outstanding;
  if (ratio > 0.5) {
    out.push({
      id: `overdue-spike-${Math.round(overdue)}`,
      kind: 'overdue_spike',
      severity: 'high',
      title: `Overdue spike: ${(ratio * 100).toFixed(0)}% of receivables overdue`,
      detail: `Of ${inr(outstanding)} in outstanding receivables, ${inr(overdue)} (${(ratio * 100).toFixed(0)}%) is past the due date. This is a collection-cycle breakdown — the business is not converting invoices to cash on time.`,
      observedValue: overdue,
      expectedValue: outstanding * 0.3, // healthy benchmark: <30% overdue
      estimatedImpact: overdue,
      evidenceId: pickEvidenceId(ctx, ctx.invoices.evidence.id, 'invoices-fy'),
      recommendedAction: 'Send reminders to the top 5 overdue customers by balance. Escalate to a call for any invoice >30 days overdue.',
      hasSufficientData: ctx.invoices.totalInvoices >= 3,
    });
  }
}

// ─── Rule 4: Customer concentration (top customer > 35%) ──────────────────────
// If customers.concentrationTop1 > 0.35 — flag.

function detectCustomerConcentration(ctx: UnifiedOracleContext, out: Anomaly[]): void {
  const top1 = ctx.customers.concentrationTop1;
  if (top1 > 0.35) {
    const topCustomer = ctx.customers.topCustomers[0];
    const severity: Anomaly['severity'] = top1 > 0.5 ? 'high' : 'medium';
    out.push({
      id: `customer-concentration-${Math.round(top1 * 100)}`,
      kind: 'customer_concentration',
      severity,
      title: `Customer concentration: top customer is ${(top1 * 100).toFixed(0)}% of revenue`,
      detail: topCustomer
        ? `${topCustomer.name} represents ${(top1 * 100).toFixed(0)}% of total invoiced revenue. A 30-day payment delay from this single customer would materially impact cash flow. Concentration above 35% is considered elevated; above 50% is critical.`
        : `The top customer represents ${(top1 * 100).toFixed(0)}% of total invoiced revenue. Concentration above 35% is considered elevated; above 50% is critical.`,
      observedValue: top1,
      expectedValue: 0.25, // healthy benchmark: <25% from any single customer
      estimatedImpact: ctx.revenue.invoicedRevenue * top1 * 0.1, // 10% delay impact proxy
      evidenceId: pickEvidenceId(ctx, ctx.customers.evidence.id, 'invoices-fy'),
      recommendedAction: 'Diversify the customer base or negotiate shorter payment terms with the top customer. Build pipeline for at least 2 mid-sized accounts to dilute concentration.',
      hasSufficientData: ctx.customers.totalCustomers >= 3,
    });
  }
}

// ─── Rule 5: Cash decline (>50% drop from opening) ────────────────────────────
// If cashFlow.currentBalance < cashFlow.openingBalance * 0.5 — flag.

function detectCashDecline(ctx: UnifiedOracleContext, out: Anomaly[]): void {
  const opening = ctx.cashFlow.openingBalance;
  const current = ctx.cashFlow.currentBalance;
  if (opening <= 0) return; // can't compute a meaningful ratio from zero opening
  if (current < opening * 0.5) {
    const dropPct = ((opening - current) / opening) * 100;
    const severity: Anomaly['severity'] = current < 0 ? 'critical' : 'high';
    out.push({
      id: `cash-decline-${Math.round(current)}`,
      kind: 'cash_decline',
      severity,
      title: `Cash decline: ${dropPct.toFixed(0)}% drop this period`,
      detail: `Cash position dropped from ${inr(opening)} to ${inr(current)} — a ${dropPct.toFixed(0)}% decline. ${ctx.cashFlow.isEstimatedFromPaymentFlow ? 'Note: cash is estimated from payment flow because banking is not connected.' : 'Banking is connected, so this is a real cash movement.'}`,
      observedValue: current,
      expectedValue: opening,
      estimatedImpact: opening - current,
      evidenceId: pickEvidenceId(ctx, ctx.cashFlow.evidence.id, 'banking'),
      recommendedAction: 'Review outflows in the last 30 days. If the decline is from a one-off vendor payment, plan the recovery path; if it is structural burn, raise collections urgency.',
      hasSufficientData: true,
    });
  }
}

// ─── Rule 6: Duplicate invoice (DB query) ─────────────────────────────────────
// Read-only Prisma query: invoices in the last 90 days, grouped by
// (buyerName, totalAmount rounded to integer). If a group has >1 entry, flag.

async function detectDuplicateInvoice(ctx: UnifiedOracleContext, out: Anomaly[]): Promise<void> {
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000);
    // invoiceDate is stored as a 'YYYY-MM-DD' string (see oracle-cfo/tools.ts
    // and gstpilot-data/invoices.ts), so the filter must use a comparable
    // ISO date string, not a Date object.
    const since = ninetyDaysAgo.toISOString().slice(0, 10);

    const recent = await db.invoice.findMany({
      where: {
        client: { firmId: ctx.organizationId },
        invoiceDate: { gte: since },
      },
      select: {
        invoiceNumber: true,
        buyerName: true,
        totalAmount: true,
        client: { select: { tradeName: true } },
      },
      take: 5000,
    });

    if (recent.length === 0) return;

    // Group by (normalised buyerName, rounded totalAmount within ₹1).
    const groups = new Map<string, Array<{
      invoiceNumber: string;
      buyer: string;
      amount: number;
    }>>();

    for (const inv of recent) {
      const buyer = (inv.buyerName ?? inv.client?.tradeName ?? 'Unknown').trim().toLowerCase();
      const amount = Math.round(inv.totalAmount ?? 0);
      const key = `${buyer}|${amount}`;
      const arr = groups.get(key) ?? [];
      arr.push({
        invoiceNumber: inv.invoiceNumber,
        buyer: inv.buyerName ?? inv.client?.tradeName ?? 'Unknown',
        amount: inv.totalAmount ?? 0,
      });
      groups.set(key, arr);
    }

    const hasSufficientData = recent.length >= 3;

    for (const [, arr] of groups) {
      if (arr.length < 2) continue;
      const sample = arr[0];
      const numbers = arr.map(a => a.invoiceNumber).filter(Boolean).join(', ');
      out.push({
        id: `duplicate-invoice-${sample.buyer.toLowerCase().replace(/\s+/g, '-')}-${Math.round(sample.amount)}`,
        kind: 'duplicate_invoice',
        severity: 'high',
        title: `Duplicate invoice: ${arr.length} invoices for ${sample.buyer} at ${inr(sample.amount)}`,
        detail: `${arr.length} invoices with the same buyer name and total amount (${inr(sample.amount)}, within ₹1) were raised in the last 90 days. Invoice numbers: ${numbers || '(none)'}. Possible duplicate billing, split-billing error, or legitimate repeat billing — verify each one.`,
        observedValue: arr.length,
        expectedValue: 1,
        estimatedImpact: sample.amount * (arr.length - 1), // potential duplicate exposure
        evidenceId: pickEvidenceId(ctx, 'invoices-fy', 'invoices-fy'),
        recommendedAction: `Review invoices ${numbers || ''} — confirm whether they are legitimate separate billings or duplicates to be cancelled with a credit note.`,
        hasSufficientData,
      });
    }
  } catch {
    // DB error — do not fabricate. Silently skip.
  }
}

// ─── Rule 7: GST mismatch (mismatched + missingIn2B > 0) ──────────────────────

function detectGstMismatch(ctx: UnifiedOracleContext, out: Anomaly[]): void {
  const { mismatched, missingIn2B, itcAtRisk } = ctx.gst.reconciliation;
  const count = mismatched + missingIn2B;
  if (count <= 0) return;

  const severity: Anomaly['severity'] = itcAtRisk > 50_000 ? 'high' : 'medium';
  out.push({
    id: `gst-mismatch-${count}`,
    kind: 'gst_mismatch',
    severity,
    title: `GST reconciliation mismatch: ${count} invoices, ${inr(itcAtRisk)} ITC at risk`,
    detail: `${count} supplier invoices (${mismatched} mismatched, ${missingIn2B} missing in GSTR-2B) have reconciliation issues. ITC of ${inr(itcAtRisk)} may be denied by the department if not resolved before filing.`,
    observedValue: count,
    expectedValue: 0,
    estimatedImpact: itcAtRisk,
    evidenceId: pickEvidenceId(ctx, ctx.gst.evidence.id, 'gst-fy'),
    recommendedAction: 'Open the GST reconciliation report. Follow up with each supplier whose invoice is mismatched or missing in 2B before the next return filing.',
    hasSufficientData: ctx.gst.gspConnected,
  });
}

// ─── Rule 8: Missing GSTR-2B (missingIn2B > 0) ────────────────────────────────

function detectMissingGstr2b(ctx: UnifiedOracleContext, out: Anomaly[]): void {
  const { missingIn2B, itcAtRisk } = ctx.gst.reconciliation;
  if (missingIn2B <= 0) return;
  out.push({
    id: `missing-gstr2b-${missingIn2B}`,
    kind: 'missing_gstr2b',
    severity: 'medium',
    title: `Missing GSTR-2B: ${missingIn2B} purchase invoices not in 2B`,
    detail: `${missingIn2B} purchase invoices recorded in your books do not appear in GSTR-2B. Either the supplier has not filed their GSTR-1, or there is a GSTIN mismatch. ITC of ${inr(itcAtRisk)} is at risk.`,
    observedValue: missingIn2B,
    expectedValue: 0,
    estimatedImpact: itcAtRisk,
    evidenceId: pickEvidenceId(ctx, ctx.gst.evidence.id, 'gst-fy'),
    recommendedAction: 'Contact the suppliers of the missing invoices. Request they file their GSTR-1 so the entries flow into your GSTR-2B next cycle.',
    hasSufficientData: ctx.gst.gspConnected,
  });
}

// ─── Rule 9: Supplier compliance (any top supplier gstCompliant === false) ────

function detectSupplierCompliance(ctx: UnifiedOracleContext, out: Anomaly[]): void {
  const nonCompliant = ctx.suppliers.topSuppliers.filter(s => s.gstCompliant === false);
  if (nonCompliant.length === 0) return;

  const names = nonCompliant.map(s => s.name).slice(0, 5).join(', ');
  const totalSpend = nonCompliant.reduce((s, x) => s + x.spend, 0);
  out.push({
    id: `supplier-compliance-${nonCompliant.length}`,
    kind: 'supplier_compliance',
    severity: 'medium',
    title: `Non-compliant suppliers: ${nonCompliant.length} top suppliers have invalid GSTIN`,
    detail: `${nonCompliant.length} of your top ${ctx.suppliers.topSuppliers.length} suppliers have an invalid or absent GSTIN pattern: ${names}. ITC on bills from these suppliers may be denied. Total spend at risk: ${inr(totalSpend)}.`,
    observedValue: nonCompliant.length,
    expectedValue: 0,
    estimatedImpact: totalSpend,
    evidenceId: pickEvidenceId(ctx, ctx.suppliers.evidence.id, 'expenses-fy'),
    recommendedAction: 'Request a valid GSTIN from each non-compliant supplier before the next purchase. Update the vendor master once received.',
    hasSufficientData: ctx.suppliers.totalSuppliers >= 3,
  });
}

// ─── Rule 10: Payment delay pattern (avgDaysToPay > 60) ───────────────────────

function detectPaymentDelayPattern(ctx: UnifiedOracleContext, out: Anomaly[]): void {
  const adp = ctx.invoices.avgDaysToPay;
  if (adp <= 60) return;
  const severity: Anomaly['severity'] = adp > 90 ? 'high' : 'medium';
  out.push({
    id: `payment-delay-${Math.round(adp)}`,
    kind: 'payment_delay_pattern',
    severity,
    title: `Slow collections: avg days-to-pay is ${Math.round(adp)} days`,
    detail: `Your customers take an average of ${Math.round(adp)} days to pay invoices. Standard terms are 30 days. A collection cycle above 60 days strains working capital and increases the cash-conversion gap.`,
    observedValue: adp,
    expectedValue: 30,
    estimatedImpact: ctx.invoices.outstanding * ((adp - 30) / 30) * 0.01, // rough proxy
    evidenceId: pickEvidenceId(ctx, ctx.invoices.evidence.id, 'invoices-fy'),
    recommendedAction: 'Tighten payment terms on new invoices. Offer a 1-2% early-payment discount for settlement within 10 days. Send automated reminders 7 days before due date.',
    hasSufficientData: ctx.invoices.totalInvoices >= 3,
  });
}

// ─── Rule 11: Suspicious transaction (amount > 5x median) ─────────────────────

function detectSuspiciousTransaction(ctx: UnifiedOracleContext, out: Anomaly[]): void {
  const txns = ctx.banking.recentTransactions;
  if (txns.length < 5) return; // need a reasonable sample for the median
  const amounts = txns.map(t => Math.abs(t.amount));
  const med = median(amounts);
  if (med <= 0) return; // avoid false positives on all-zero transactions

  for (const t of txns) {
    const abs = Math.abs(t.amount);
    if (abs > 5 * med) {
      const direction = t.amount >= 0 ? 'credit' : 'debit';
      out.push({
        id: `suspicious-txn-${t.id}`,
        kind: 'suspicious_transaction',
        severity: 'medium',
        title: `Unusual ${direction}: ${inr(abs)} vs median ${inr(med)}`,
        detail: `Bank transaction "${t.description || '(no description)'}" on ${t.date.slice(0, 10)} for ${inr(abs)} is more than 5x the median transaction size (${inr(med)}). This is statistically unusual — verify it is a legitimate business receipt/payment.`,
        observedValue: abs,
        expectedValue: med,
        evidenceId: pickEvidenceId(ctx, ctx.banking.evidence.id, 'banking'),
        recommendedAction: `Open the banking view and review transaction ${t.id}. If unrecognised, raise a dispute with the bank. If recognised, tag it for audit trail.`,
        hasSufficientData: txns.length >= 5,
      });
    }
  }
}

// ─── Rule 12: Sudden expense growth (doubled MoM) — critical ──────────────────

function detectSuddenExpenseGrowth(ctx: UnifiedOracleContext, out: Anomaly[]): void {
  const { thisMonth, lastMonth } = ctx.expenses.trend;
  if (lastMonth <= 0) return;
  if (thisMonth > lastMonth * 2) {
    const multiplier = thisMonth / lastMonth;
    out.push({
      id: `sudden-expense-growth-${Math.round(thisMonth)}`,
      kind: 'sudden_expense_growth',
      severity: 'critical',
      title: `Sudden expense growth: ${multiplier.toFixed(1)}x MoM`,
      detail: `Operating expenses this month (${inr(thisMonth)}) are ${multiplier.toFixed(1)}x last month's (${inr(lastMonth)}). A doubling in expenses is a red flag — possible fraudulent entries, mis-coded invoices, or a real cost overrun that needs immediate attention.`,
      observedValue: thisMonth,
      expectedValue: lastMonth,
      estimatedImpact: thisMonth - lastMonth,
      evidenceId: pickEvidenceId(ctx, ctx.expenses.evidence.id, 'expenses-fy'),
      recommendedAction: 'Immediately audit every expense entry above ₹10,000 from this month. Reconcile against bank statements and vendor bills. Lock the books once verified.',
      hasSufficientData: true,
    });
  }
}
