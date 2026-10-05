// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ (Invoice Cloud™) — Oracle Orchestrator + Context
// Composes the full InvoiceCloudState from all 10 modules and formats it for Oracle.
// Deterministic. No LLM. Oracle consumes the formatted block.
// ═══════════════════════════════════════════════════════════════════════════════

import { getInvoices } from './invoices';
import { getPurchaseBills } from './purchases';
import { getExpenses } from './expenses';
import { getReceivables } from './receivables';
import { getPayables } from './payables';
import { getPayments } from './payments';
import { getTDSRecords } from './tds';
import { getPayroll } from './payroll';
import { getAnalytics } from './analytics';
import { getOCRList } from './ocr';
import { getIntelligence } from './intelligence';
import { inrShort, type InvoiceCloudState } from './types';

// ─── Compose full InvoiceCloudState ────────────────────────────────────────────

export async function getInvoiceCloudState(): Promise<InvoiceCloudState> {
  const [
    invoices,
    purchases,
    expenses,
    receivables,
    payables,
    payments,
    tds,
    payroll,
    ocr,
  ] = await Promise.all([
    getInvoices({ limit: 500 }),
    getPurchaseBills({ limit: 500 }),
    getExpenses({ limit: 500 }),
    getReceivables({ limit: 500 }),
    getPayables({ limit: 500 }),
    getPayments({ limit: 500 }),
    getTDSRecords({ limit: 500 }),
    getPayroll(),
    getOCRList(50),
  ]);

  const analytics = await getAnalytics({
    invoices,
    purchases,
    expenses,
    receivables,
    payroll,
  });

  const intelligence = await getIntelligence({
    invoices,
    expenses,
    receivables,
    payables,
    payments,
    payroll,
    analytics,
  });

  const hasLiveData =
    invoices.hasLiveData ||
    purchases.hasLiveData ||
    expenses.hasLiveData ||
    receivables.hasLiveData ||
    payables.hasLiveData ||
    payments.hasLiveData ||
    tds.hasLiveData ||
    payroll.hasLiveData ||
    ocr.hasLiveData ||
    analytics.hasLiveData ||
    intelligence.hasLiveData;

  return {
    invoices,
    purchases,
    expenses,
    receivables,
    payables,
    payments,
    tds,
    payroll,
    analytics,
    ocr,
    intelligence,
    hasLiveData,
  };
}

// ─── Oracle Context Block ──────────────────────────────────────────────────────

export function formatInvoiceCloudContextBlock(state: InvoiceCloudState): string {
  if (!state.hasLiveData) {
    return `## LIVE INVOICE CLOUD STATE
No invoices, expenses, or payroll data connected yet. Encourage the user to create their first invoice, record a purchase bill, or add an employee to unlock the Real Invoice Engine. Do not fabricate ERP numbers.`;
  }

  const inv = state.invoices;
  const pur = state.purchases;
  const exp = state.expenses;
  const rec = state.receivables;
  const pay = state.payables;
  const pm = state.payments;
  const tds = state.tds;
  const pr = state.payroll;
  const an = state.analytics;

  // ─── Module 1: Invoices ────────────────────────────────────────────────────
  const recentInvoices = inv.invoices.slice(0, 6).map(
    (i) => `  - ${i.invoiceNo} · ${i.clientName} · ${inrShort(i.total)} · ${i.status} · ${i.paymentStatus} (paid ${inrShort(i.paidAmount)}, due ${inrShort(i.balanceDue)})`,
  ).join('\n');

  // ─── Module 2: Purchase Bills ──────────────────────────────────────────────
  const recentBills = pur.bills.slice(0, 6).map(
    (b) => `  - ${b.billNo} · ${b.vendorName} · ${inrShort(b.total)} · ITC ${b.itcEligible ? 'eligible ' + inrShort(b.itcAmount) : 'BLOCKED'} · ${b.paymentStatus}`,
  ).join('\n');

  // ─── Module 3: Expenses ────────────────────────────────────────────────────
  const topExpenses = exp.byCategory.slice(0, 5).map(
    (c) => `  - ${c.label}: ${inrShort(c.total)} across ${c.count} entries (${c.changePct >= 0 ? '+' : ''}${c.changePct}% vs last month)`,
  ).join('\n');

  // ─── Module 4: Receivables ─────────────────────────────────────────────────
  const agingBreakdown = rec.byAging.map(
    (b) => `${b.label}: ${b.count} invoices · ${inrShort(b.amount)} (expected ${inrShort(b.expectedCollection)})`,
  ).join(' | ');
  const topOverdue = rec.receivables
    .filter((r) => r.daysOverdue > 0)
    .slice(0, 5)
    .map(
      (r) => `  - ${r.customerName}: ${inrShort(r.balanceDue)} overdue ${r.daysOverdue}d (${r.riskLevel}, collection prob ${Math.round(r.collectionProbability * 100)}%)`,
    )
    .join('\n');

  // ─── Module 5: Payables ────────────────────────────────────────────────────
  const topPayables = pay.payables.slice(0, 5).map(
    (p) => `  - ${p.vendorName}: ${inrShort(p.balanceDue)} due in ${p.daysUntilDue}d (${p.priority}, score ${p.priorityScore}/100)`,
  ).join('\n');

  // ─── Module 6: Payments ────────────────────────────────────────────────────
  const recentPayments = pm.payments.slice(0, 6).map(
    (p) => `  - ${p.direction === 'incoming' ? '↘' : '↗'} ${p.customerName ?? p.vendorName ?? '—'}: ${inrShort(p.amount)} via ${p.mode} · ${p.reconciled ? 'reconciled' : 'unreconciled'}`,
  ).join('\n');

  // ─── Module 7: TDS ─────────────────────────────────────────────────────────
  const tdsBySec = tds.bySection.slice(0, 5).map(
    (s) => `  - Sec ${s.section} (${s.natureOfPayment}): ${s.count} records · payment ${inrShort(s.paymentAmount)} · TDS ${inrShort(s.tdsAmount)}`,
  ).join('\n');

  // ─── Module 8: Payroll ─────────────────────────────────────────────────────
  const payrollStats = pr.currentMonthPayroll;

  // ─── Module 9: Analytics ───────────────────────────────────────────────────
  const topClients = an.topClients.slice(0, 5).map(
    (c) => `  - ${c.clientName}: ${inrShort(c.totalRevenue)} revenue (${c.pctOfRevenue}% of total) · outstanding ${inrShort(c.outstanding)}`,
  ).join('\n');

  const monthlyTrend = an.monthlyTrend.map(
    (m) => `${m.month}: rev ${inrShort(m.revenue)}, exp ${inrShort(m.expenses)}, profit ${inrShort(m.profit)} (${m.marginPct}% margin)`,
  ).join(' | ');

  // ─── Module 9: OCR Engine ───────────────────────────────────────────────────
  const ocr = state.ocr;
  const recentOcr = ocr.recent.slice(0, 5).map(
    (o) => `  - ${o.fileName} · ${o.vendorName ?? 'Unknown'} · ${inrShort(o.totalAmount)} · ${o.confidence} conf (${Math.round(o.confidenceScore * 100)}%) · ${o.itcEligible ? 'ITC ' + inrShort(o.itcAmount) : 'ITC BLOCKED'} · cat ${o.category}`,
  ).join('\n');

  // ─── Module 10: Revenue Intelligence ───────────────────────────────────────
  const intel = state.intelligence;
  const forecastLines = intel.forecasts.map(
    (f) => `  - ${f.horizonLabel}: revenue ${inrShort(f.expectedRevenue)}, collections ${inrShort(f.expectedCollections)}, profit ${inrShort(f.projectedProfit)} (${f.projectedMarginPct}% margin), net cash ${inrShort(f.netCashPosition)} · ${Math.round(f.confidence * 100)}% confidence`,
  ).join('\n');
  const pipelineLines = intel.pipeline.map(
    (p) => `  - ${p.label}: ${inrShort(p.amount)} (${p.count} items, ${p.deltaPct >= 0 ? '+' : ''}${p.deltaPct}% vs last month)`,
  ).join('\n');

  return `## LIVE INVOICE CLOUD STATE (Phase 8 Step 3 — GSTPilot Real Invoice Engine™)
You have real-time access to the user's complete ERP: invoices, expenses, receivables, payables, payments, TDS, payroll, OCR, and revenue intelligence. Treat these numbers as authoritative when the user asks about any sale, expense, collection, payment, payroll, forecast, or profitability.

### Module 1 — Sales Invoice Engine
- ${inv.total} invoices · Total revenue: ${inrShort(inv.totalRevenue)} · Paid: ${inrShort(inv.totalPaid)} · Outstanding: ${inrShort(inv.totalOutstanding)} · Overdue: ${inrShort(inv.totalOverdue)}
${recentInvoices || '  · No invoices yet.'}

### Module 2 — Purchase Bill Engine
- ${pur.total} purchase bills · Total purchases: ${inrShort(pur.totalPurchaseValue)} · Eligible ITC: ${inrShort(pur.eligibleITC)} · Blocked ITC: ${inrShort(pur.blockedITC)} · Outstanding: ${inrShort(pur.totalOutstanding)}
- ${pur.vendors.length} active vendors
${recentBills || '  · No purchase bills yet.'}

### Module 3 — Expense Management
- ${exp.total} expenses · Total: ${inrShort(exp.totalAmount)} · This month: ${inrShort(exp.thisMonthTotal)} (${exp.changePct >= 0 ? '+' : ''}${exp.changePct}% vs last month ${inrShort(exp.lastMonthTotal)}) · Recurring: ${exp.recurringCount}
${topExpenses || '  · No expenses yet.'}

### Module 4 — Receivables Engine
- Total outstanding: ${inrShort(rec.totalOutstanding)} across ${rec.total} receivables · Expected collection: ${inrShort(rec.totalExpected)} (${rec.collectionEfficiencyPct}% efficiency)
- Overdue: ${rec.overdueCount} invoices · ${inrShort(rec.overdueAmount)} · Avg days overdue: ${rec.avgDaysOverdue} · Overall risk: ${rec.riskLevel.toUpperCase()}
- Aging: ${agingBreakdown}
${topOverdue || '  · No overdue receivables.'}

### Module 5 — Payables Engine
- Total due: ${inrShort(pay.totalDue)} across ${pay.total} payables · Due in 7d: ${inrShort(pay.dueIn7Days)} · Due in 30d: ${inrShort(pay.dueIn30Days)} · Overdue: ${inrShort(pay.overdueAmount)}
- Scheduled: ${pay.scheduledCount} · Avg priority score: ${pay.avgPriorityScore}/100
${topPayables || '  · No pending payables.'}

### Module 6 — Payment Engine
- ${pm.total} payments · Incoming: ${inrShort(pm.totalIncoming)} (${pm.incomingCount}) · Outgoing: ${inrShort(pm.totalOutgoing)} (${pm.outgoingCount})
- Reconciliation rate: ${pm.reconciliationRatePct}% · Reconciled: ${pm.reconciledCount} · Unreconciled: ${pm.unreconciledCount}
${recentPayments || '  · No payments yet.'}

### Module 7 — TDS Engine
- ${tds.total} TDS records · Total payment: ${inrShort(tds.totalPaymentAmount)} · Total TDS deducted: ${inrShort(tds.totalTDS)}
- Pending challan: ${tds.pendingChallanCount} · Pending return: ${tds.pendingReturnCount}
- By status: deducted ${tds.byStatus.deducted}, challan_ready ${tds.byStatus.challan_ready}, challan_paid ${tds.byStatus.challan_paid}, return_filed ${tds.byStatus.return_filed}
${tdsBySec || '  · No TDS records yet.'}

### Module 8 — Payroll Cloud (${payrollStats.month})
- ${pr.totalEmployees} employees (${pr.activeEmployees} active)
- Gross: ${inrShort(payrollStats.totalGross)} · Deductions: ${inrShort(payrollStats.totalDeductions)} · Net: ${inrShort(payrollStats.totalNet)}
- Employer PF: ${inrShort(payrollStats.employerPF)} · Employer ESI: ${inrShort(payrollStats.employerESI)} · Total cost: ${inrShort(payrollStats.totalCost)}
- Processed: ${payrollStats.processed} · Paid: ${payrollStats.paid} · Pending: ${payrollStats.pending}

### Invoice Analytics (foundation for Revenue Intelligence)
- Total revenue: ${inrShort(an.totalRevenue)} · This month: ${inrShort(an.revenueThisMonth)} (${an.revenueGrowthPct >= 0 ? '+' : ''}${an.revenueGrowthPct}% vs last month ${inrShort(an.revenueLastMonth)})
- Gross margin: ${inrShort(an.grossMargin)} (${an.grossMarginPct}%) · Net profit: ${inrShort(an.netProfit)} (${an.netMarginPct}%) · Expense ratio: ${an.expenseRatioPct}%
- Collection efficiency: ${an.collectionEfficiencyPct}% · Avg collection days: ${an.avgCollectionDays}
- Total invoices: ${an.totalInvoices} · Paid: ${an.paidInvoices} · Overdue: ${an.overdueInvoices}
- Total purchase value: ${inrShort(an.totalPurchaseValue)} · Total ITC: ${inrShort(an.totalITC)} · Total payroll cost: ${inrShort(an.totalPayrollCost)}
- Top clients:
${topClients || '  · No client revenue data yet.'}
- Monthly trend (last 6 months):
  ${monthlyTrend || '  · No trend data yet.'}

### Module 9 — PDF & OCR Engine
- ${ocr.total} bills imported via OCR · High confidence: ${ocr.highConfidence} · Needs review: ${ocr.needsReview} · Failed: ${ocr.failed}
${recentOcr || '  · No bills imported via OCR yet.'}

### Module 10 — Revenue Intelligence™
- MRR: ${inrShort(intel.mrr)} (${intel.mrrTrendPct >= 0 ? '+' : ''}${intel.mrrTrendPct}% trend) · ARR: ${inrShort(intel.arr)}
- Revenue: ${inrShort(intel.revenue)} · This month: ${inrShort(intel.revenueThisMonth)} (${intel.revenueGrowthPct >= 0 ? '+' : ''}${intel.revenueGrowthPct}%) · Expenses: ${inrShort(intel.expenses)} · Net profit: ${inrShort(intel.profit)} (${intel.marginPct}% margin)
- Cash position: ${inrShort(intel.cashPosition.cashInHand)} in hand · 30d inflow ${inrShort(intel.cashPosition.cashInflow30d)} / outflow ${inrShort(intel.cashPosition.cashOutflow30d)} · Burn ${inrShort(intel.cashPosition.burnRate)}/mo · Runway ${intel.cashPosition.runwayMonths} months
- Collections: next 7 days ${inrShort(intel.collectionsNext7Days)} · next 30 days ${inrShort(intel.collectionsNext30Days)} · forecast ${inrShort(intel.collectionForecast)}
- Pipeline:
${pipelineLines}
- Forecasts:
${forecastLines}
- Deterministic insights (use these verbatim when relevant):
${intel.insights.map((i) => `  ✅ ${i}`).join('\n')}

When answering Invoice Cloud questions, ALWAYS:
1. Lead with the spoken ack in past tense ("I've created Invoice INV-2026-001.", "I've detected ₹X outstanding.", "I've calculated your TDS liability.", "I've processed payroll for N employees.", "I've identified your top customer.", "I've reconciled the payment.", "I've forecasted next month's revenue.", "I've extracted the bill via OCR.", "I've predicted ₹X collections next week.")
2. Cite the exact numbers from above — never fabricate.
3. For invoice questions, give the invoice number + client name + amount + status.
4. For expense questions, give the category breakdown + monthly change %.
5. For receivables, give the aging buckets + expected collection + risk level.
6. For TDS, give the section + rate + amount + challan status.
7. For payroll, give the employee count + gross/net/employer contributions.
8. For analytics, give the revenue + margin + growth + top client.
9. For OCR, give the vendor + amount + confidence + ITC eligibility.
10. For revenue intelligence, give the MRR/ARR + forecast + cash position + collections + pipeline.
NEVER say "You can create an invoice." Instead: "I've created Invoice [INV-XXXX]." / "I've sent the invoice." / "I've generated the PDF and payment link." / "I've forecasted ₹X revenue next month." / "I've extracted the bill details via OCR."`;
}
