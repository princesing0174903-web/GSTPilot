// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI CFO™ — GST Report Explanation Layer
//
// Turns the structured GSTReport into plain-English insights.
// Every insight references real records (invoice IDs, customer names, vendor names).
// No vague statements — every claim has data behind it.
//
// This module powers:
//   • The "Oracle Insights" section of the GST report PDF/XLSX/CSV
//   • The DecisionCard's "why" + supporting records when the user asks for a report
//   • The narrative summary returned by /api/oracle/cfo/analyze
// ═══════════════════════════════════════════════════════════════════════════════

import type { GSTReport, TopContributor, GSTCalculations, GSTValidationReport } from './gst-report-engine';

/**
 * Build a plain-English narrative explanation of the GST report.
 * Every line references real numbers / records from the report.
 */
export function explainGSTReport(report: GSTReport): {
  insights: string[];
  recommendations: string[];
  whySummary: string;
} {
  const insights: string[] = [];
  const recommendations: string[] = [];
  const calc = report.calculations;
  const val = report.validation;

  // ─── 1. Output tax delta vs prior period ──
  insights.push(...explainOutputDelta(calc));

  // ─── 2. Top customer contribution ──
  insights.push(...explainTopCustomers(report.topCustomers, calc));

  // ─── 3. Top vendor / ITC contribution ──
  insights.push(...explainTopVendors(report.topVendors, calc));

  // ─── 4. ITC changes & utilization ──
  insights.push(...explainITC(calc));

  // ─── 5. Missing invoices / data gaps ──
  insights.push(...explainDataGaps(report, val));

  // ─── 6. Compliance risks ──
  insights.push(...explainComplianceRisks(report, val));

  // ─── 7. Cross-check mismatches ──
  insights.push(...explainCrossChecks(calc));

  // ─── Recommendations ──
  recommendations.push(...buildRecommendations(report, val));

  // ─── One-paragraph summary ──
  const whySummary = buildWhySummary(report);

  return { insights, recommendations, whySummary };
}

// ─── Output tax delta ──────────────────────────────────────────────────────

function explainOutputDelta(calc: GSTCalculations): string[] {
  const out: string[] = [];
  if (calc.priorPeriodOutputTax > 0) {
    const direction = calc.deltaOutputTax > 0 ? 'increased' : calc.deltaOutputTax < 0 ? 'decreased' : 'stayed flat';
    const absChange = Math.abs(calc.deltaOutputTax);
    out.push(
      `Output GST ${direction} by ₹${absChange.toLocaleString('en-IN')} (${calc.deltaPercent > 0 ? '+' : ''}${calc.deltaPercent}%) vs the prior period — current ₹${calc.totalOutputTax.toLocaleString('en-IN')} vs prior ₹${calc.priorPeriodOutputTax.toLocaleString('en-IN')}.`,
    );
    if (calc.deltaPercent > 20) {
      out.push(`Significant jump (>20%) — verify no duplicate or back-dated invoices were entered this period.`);
    } else if (calc.deltaPercent < -20) {
      out.push(`Significant drop (>20%) — confirm no invoices are missing from this period and that all sales were captured.`);
    }
  } else {
    out.push(`Output GST for this period is ₹${calc.totalOutputTax.toLocaleString('en-IN')}. No prior-period data available for comparison — first reporting period.`);
  }
  return out;
}

// ─── Top customers ─────────────────────────────────────────────────────────

function explainTopCustomers(customers: TopContributor[], calc: GSTCalculations): string[] {
  const out: string[] = [];
  if (customers.length === 0) {
    out.push(`No sales invoices found for this period — top-customer analysis not available.`);
    return out;
  }
  const top = customers[0];
  const topShare = calc.totalOutputTax > 0
    ? Math.round((top.taxAmount / calc.totalOutputTax) * 100)
    : 0;
  out.push(
    `Top customer "${top.name}"${top.gstin ? ` (GSTIN ${top.gstin})` : ''} contributed ₹${top.taxAmount.toLocaleString('en-IN')} in GST (${topShare}% of total output tax) across ${top.invoiceCount} invoices.`,
  );
  if (customers.length >= 3) {
    const top3Share = customers.slice(0, 3).reduce((s, c) => s + c.taxAmount, 0);
    const top3Pct = calc.totalOutputTax > 0 ? Math.round((top3Share / calc.totalOutputTax) * 100) : 0;
    out.push(
      `Top 3 customers (${customers.slice(0, 3).map((c) => c.name).join(', ')}) account for ${top3Pct}% of output tax — ${top3Pct > 60 ? 'high concentration risk' : 'diversified base'}.`,
    );
  }
  return out;
}

// ─── Top vendors / ITC ─────────────────────────────────────────────────────

function explainTopVendors(vendors: TopContributor[], calc: GSTCalculations): string[] {
  const out: string[] = [];
  if (vendors.length === 0) {
    out.push(`No purchase invoices (ITC source) found for this period — ITC is ₹0. Add purchase bills to claim input tax credit.`);
    return out;
  }
  const top = vendors[0];
  const topShare = calc.itcAvailable > 0 ? Math.round((top.taxAmount / calc.itcAvailable) * 100) : 0;
  out.push(
    `Top vendor "${top.name}"${top.gstin ? ` (GSTIN ${top.gstin})` : ''} contributed ₹${top.taxAmount.toLocaleString('en-IN')} in ITC (${topShare}% of total available ITC) across ${top.invoiceCount} invoices.`,
  );
  return out;
}

// ─── ITC ──────────────────────────────────────────────────────────────────

function explainITC(calc: GSTCalculations): string[] {
  const out: string[] = [];
  out.push(
    `ITC available: ₹${calc.itcAvailable.toLocaleString('en-IN')} (CGST ₹${calc.itcCGST.toLocaleString('en-IN')} + SGST ₹${calc.itcSGST.toLocaleString('en-IN')} + IGST ₹${calc.itcIGST.toLocaleString('en-IN')} + Cess ₹${calc.itcCess.toLocaleString('en-IN')}). After Rule 42/43 reversal of ₹${calc.itcReversed.toLocaleString('en-IN')} for exempt supplies, ITC utilized is ₹${calc.itcUtilized.toLocaleString('en-IN')}.`,
  );
  if (calc.refundEligible > 0) {
    out.push(
      `Refund eligibility: ₹${calc.refundEligible.toLocaleString('en-IN')} — accumulated ITC after setting off output liability. File refund application on GST portal under relevant category (export/inverted duty).`,
    );
  }
  if (calc.itcReversed > 0 && calc.itcAvailable > 0) {
    const reversalPct = Math.round((calc.itcReversed / calc.itcAvailable) * 100);
    if (reversalPct > 10) {
      out.push(`High ITC reversal (${reversalPct}%) — review exempt-supply proportionality; partial reversal may be over-stated.`);
    }
  }
  return out;
}

// ─── Missing invoices / data gaps ──────────────────────────────────────────

function explainDataGaps(report: GSTReport, val: GSTValidationReport): string[] {
  const out: string[] = [];
  if (report.dataSummary.salesInvoiceCount === 0) {
    out.push(`No sales invoices found for ${report.intent.periodLabel}. If sales occurred, they may be missing from the register — upload or enter them before filing.`);
  }
  if (report.dataSummary.purchaseInvoiceCount === 0 && report.dataSummary.expenseCount === 0) {
    out.push(`No purchase invoices or expenses recorded for ${report.intent.periodLabel} — ITC will be ₹0, which means net GST payable equals output tax. Reconcile with GSTR-2B before filing.`);
  }
  if (val.futureDatedInvoices.length > 0) {
    out.push(`${val.futureDatedInvoices.length} invoice(s) are dated in the future: ${val.futureDatedInvoices.slice(0, 5).join(', ')}${val.futureDatedInvoices.length > 5 ? ' …' : ''}. Correct the dates before filing.`);
  }
  return out;
}

// ─── Compliance risks ──────────────────────────────────────────────────────

function explainComplianceRisks(_report: GSTReport, val: GSTValidationReport): string[] {
  const out: string[] = [];
  if (val.criticalCount > 0) {
    out.push(
      `${val.criticalCount} critical validation issue(s) detected across ${val.totalChecked} invoices. Filing without resolving these may trigger GST notices. Top issues: ${summarizeTopIssues(val, 'critical')}.`,
    );
  }
  if (val.duplicateInvoiceNumbers.length > 0) {
    out.push(
      `${val.duplicateInvoiceNumbers.length} duplicate invoice number(s) detected: ${val.duplicateInvoiceNumbers.slice(0, 5).join(', ')}${val.duplicateInvoiceNumbers.length > 5 ? ' …' : ''}. Same number used on multiple invoices — correct before GSTR-1 filing or it will be rejected.`,
    );
  }
  if (val.invalidGstins.length > 0) {
    out.push(
      `${val.invalidGstins.length} invalid GSTIN(s) detected: ${val.invalidGstins.slice(0, 5).join(', ')}${val.invalidGstins.length > 5 ? ' …' : ''}. GSTIN must match the format 27ABCDE1234F1Z5 — verify against GST portal.`,
    );
  }
  if (val.reverseChargeInvoices.length > 0) {
    out.push(
      `${val.reverseChargeInvoices.length} invoice(s) under reverse charge — tax payable by recipient, report separately in GSTR-3B Table 4.`,
    );
  }
  if (val.exportInvoices.length > 0) {
    out.push(
      `${val.exportInvoices.length} export invoice(s) (zero-rated) — ensure shipping bill / LUT is referenced for refund claim. Total zero-rated value: ₹${_report.calculations.totalExport.toLocaleString('en-IN')}.`,
    );
  }
  return out;
}

// ─── Cross-checks ──────────────────────────────────────────────────────────

function explainCrossChecks(calc: GSTCalculations): string[] {
  const out: string[] = [];
  for (const check of calc.crossChecks) {
    if (!check.match) {
      out.push(
        `Cross-check FAILED: ${check.label} — expected ${check.expected} but computed ${check.actual}. Investigate before filing.`,
      );
    }
  }
  if (out.length === 0) {
    out.push(`All cross-checks passed — sum of invoice taxes matches aggregate computations (${calc.crossChecks.length} checks).`);
  }
  return out;
}

// ─── Recommendations ───────────────────────────────────────────────────────

function buildRecommendations(report: GSTReport, val: GSTValidationReport): string[] {
  const recs: string[] = [];
  const calc = report.calculations;

  if (val.criticalCount > 0) {
    recs.push(`Resolve ${val.criticalCount} critical validation issue(s) before filing — start with duplicate invoice numbers and invalid GSTINs.`);
  }
  if (val.duplicateInvoiceNumbers.length > 0) {
    recs.push(`Renumber the ${val.duplicateInvoiceNumbers.length} duplicate invoice(s) — GSTR-1 will reject duplicates.`);
  }
  if (val.invalidGstins.length > 0) {
    recs.push(`Correct ${val.invalidGstins.length} invalid GSTIN(s) — verify each on the GST portal search-taxpayer page.`);
  }
  if (calc.netPayable > 0 && calc.netPayable < 100) {
    recs.push(`Net GST payable is small (₹${calc.netPayable.toLocaleString('en-IN')}) — verify ITC utilization order (IGST → CGST → SGST) before filing.`);
  }
  if (calc.refundEligible > 0) {
    recs.push(`File refund application for ₹${calc.refundEligible.toLocaleString('en-IN')} accumulated ITC — submit RFD-01 on GST portal within 2 years of FY end.`);
  }
  if (report.dataSummary.purchaseInvoiceCount === 0) {
    recs.push(`Reconcile purchases with GSTR-2B before filing GSTR-3B — currently no ITC source data recorded.`);
  }
  if (calc.deltaPercent > 20) {
    recs.push(`Output tax jumped ${calc.deltaPercent}% vs last period — review for any back-dated or duplicate sales entries.`);
  }
  if (val.futureDatedInvoices.length > 0) {
    recs.push(`Correct ${val.futureDatedInvoices.length} future-dated invoice(s) — set dates to actual supply date.`);
  }
  if (recs.length === 0) {
    recs.push(`No critical actions required — data looks clean. Proceed with GSTR-3B filing on the GST portal.`);
  }
  return recs;
}

// ─── One-paragraph summary ─────────────────────────────────────────────────

function buildWhySummary(report: GSTReport): string {
  const calc = report.calculations;
  const val = report.validation;
  const direction = calc.deltaOutputTax > 0 ? 'up' : calc.deltaOutputTax < 0 ? 'down' : 'flat';
  return `For ${report.intent.periodLabel}, taxable turnover is ₹${calc.totalTaxableTurnover.toLocaleString('en-IN')} with output GST of ₹${calc.totalOutputTax.toLocaleString('en-IN')} (${direction} ${Math.abs(calc.deltaPercent)}% vs prior period). After utilizing ₹${calc.itcUtilized.toLocaleString('en-IN')} of ITC, net GST payable is ₹${calc.netPayable.toLocaleString('en-IN')}. The report covers ${report.dataSummary.salesInvoiceCount} sales + ${report.dataSummary.purchaseInvoiceCount} purchase invoices, with ${val.criticalCount} critical issues and ${val.warningCount} warnings flagged in validation. Top customer "${report.topCustomers[0]?.name ?? 'N/A'}" contributed the most to output tax.`;
}

// ─── Helper ────────────────────────────────────────────────────────────────

function summarizeTopIssues(val: GSTValidationReport, severity: 'critical' | 'warning' | 'info'): string {
  const issues = val.issues.filter((i) => i.severity === severity);
  const fieldCounts: Record<string, number> = {};
  for (const iss of issues) {
    fieldCounts[iss.field] = (fieldCounts[iss.field] ?? 0) + 1;
  }
  return Object.entries(fieldCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([field, count]) => `${field} (${count})`)
    .join(', ');
}
