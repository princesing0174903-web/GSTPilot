// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI CFO™ — Multi-Step Reasoning Pipeline
//
// Every financial question is run through an 8-step pipeline:
//   1. Retrieve Data      — pull live records from the business context
//   2. Validate Data      — check for missing/empty sources, flag gaps
//   3. Analyze Trends     — compute deltas, growth rates, anomalies
//   4. Compare Historical — compare current period vs prior period
//   5. Calculate Impact   — explicit math breakdown (no black-box numbers)
//   6. Generate Explanation — synthesize findings into plain-English brief
//   7. Recommend Actions  — propose 1-3 concrete next steps
//   8. Offer Execution    — if a recommendation maps to an action, propose it
//
// Each step produces a `ReasoningStep` with status + finding + duration.
// Steps that are irrelevant to the question are marked 'skipped' (not hidden)
// — this is deliberate: transparency about what was tried and what wasn't.
// ═══════════════════════════════════════════════════════════════════════════════

import type { BusinessContext, ReasoningStep, SupportingRecord } from './types';

export interface ReasoningResult {
  steps: ReasoningStep[];
  findings: string[];           // bullet-point findings (1-2 sentences each)
  supportingRecords: SupportingRecord[];
  dataSourcesUsed: string[];
  totalRecordsTouched: number;
  calculationBreakdown: string; // explicit math (plain text)
}

// ─── Pipeline orchestrator ───────────────────────────────────────────────────

export async function runReasoningPipeline(
  question: string,
  ctx: BusinessContext,
): Promise<ReasoningResult> {
  const steps: ReasoningStep[] = [];
  const findings: string[] = [];
  const supportingRecords: SupportingRecord[] = [];
  const dataSourcesUsed = new Set<string>();
  let totalRecordsTouched = 0;

  // Step 1: Retrieve Data
  const step1 = await timeStep('Retrieve Data', 'Pull live records from business context', async () => {
    const records = retrieveRecords(ctx, question);
    return {
      finding: `Retrieved ${records.length} relevant records from ${countUniqueSources(records)} data source(s).`,
      records,
    };
  });
  steps.push(step1.step);
  findings.push(step1.finding);
  supportingRecords.push(...step1.records);
  totalRecordsTouched += step1.step.recordsTouched;
  step1.records.forEach((r) => dataSourcesUsed.add(r.kind));

  // Step 2: Validate Data
  const step2 = await timeStep('Validate Data', 'Check for missing/empty data sources', async () => {
    const gaps = validateData(ctx, question);
    return {
      finding: gaps.length === 0
        ? 'All relevant data sources are available and non-empty.'
        : `Missing data sources: ${gaps.join(', ')}. Oracle will note this in the answer.`,
      gaps,
    };
  });
  steps.push(step2.step);
  findings.push(step2.finding);

  // Step 3: Analyze Trends
  const step3 = await timeStep('Analyze Trends', 'Compute deltas, growth rates, anomalies', async () => {
    return analyzeTrends(ctx, question);
  });
  steps.push(step3.step);
  findings.push(step3.finding);

  // Step 4: Compare Historical
  const step4 = await timeStep('Compare Historical', 'Compare current period vs prior period', async () => {
    return compareHistorical(ctx, question);
  });
  steps.push(step4.step);
  findings.push(step4.finding);

  // Step 5: Calculate Impact
  const step5 = await timeStep('Calculate Impact', 'Compute explicit financial math', async () => {
    return calculateImpact(ctx, question);
  });
  steps.push(step5.step);
  findings.push(step5.finding);

  // Step 6: Generate Explanation (skip — handled by the AI provider in engine.ts)
  const step6: ReasoningStep = {
    step: 6,
    name: 'Generate Explanation',
    description: 'Synthesize findings into plain-English brief',
    status: 'skipped',
    finding: 'Handled by AI provider in the orchestration layer.',
    durationMs: 0,
    recordsTouched: 0,
  };
  steps.push(step6);

  // Step 7: Recommend Actions
  const step7 = await timeStep('Recommend Actions', 'Propose 1-3 concrete next steps', async () => {
    return recommendActions(ctx, question);
  });
  steps.push(step7.step);
  findings.push(step7.finding);

  // Step 8: Offer Execution (skip — handled by tools.ts intent detection)
  const step8: ReasoningStep = {
    step: 8,
    name: 'Offer Execution',
    description: 'Map recommendation to executable action',
    status: 'skipped',
    finding: 'Handled by tool registry intent detection in the orchestration layer.',
    durationMs: 0,
    recordsTouched: 0,
  };
  steps.push(step8);

  const calculationBreakdown = buildCalculationBreakdown(ctx, question);

  return {
    steps,
    findings,
    supportingRecords,
    dataSourcesUsed: Array.from(dataSourcesUsed),
    totalRecordsTouched,
    calculationBreakdown,
  };
}

// ─── Step implementations ────────────────────────────────────────────────────

function retrieveRecords(ctx: BusinessContext, question: string): SupportingRecord[] {
  const records: SupportingRecord[] = [];
  const q = question.toLowerCase();

  // Always include a "business context snapshot" record
  records.push({
    kind: 'activity',
    id: `ctx_${ctx.organizationId}`,
    label: `${ctx.organizationName} — Business Snapshot`,
    summary: `${ctx.invoices.total} invoices, ${ctx.clients.total} clients, ${ctx.gstReturns.total} GST returns, compliance score ${ctx.compliance.score}/100`,
  });

  // Invoice-related questions
  if (q.includes('invoice') || q.includes('outstanding') || q.includes('overdue') || q.includes('payment') || q.includes('collect')) {
    records.push({
      kind: 'invoice',
      id: 'inv_outstanding',
      label: 'Outstanding Invoices',
      summary: `${ctx.invoices.sent + ctx.invoices.overdue} unpaid invoices totaling ₹${ctx.invoices.totalOutstanding.toLocaleString('en-IN')}`,
      amount: ctx.invoices.totalOutstanding,
      status: `${ctx.invoices.sent + ctx.invoices.overdue} unpaid`,
    });
    if (ctx.invoices.overdue > 0) {
      records.push({
        kind: 'invoice',
        id: 'inv_overdue',
        label: 'Overdue Invoices',
        summary: `${ctx.invoices.overdue} invoices overdue totaling ₹${ctx.invoices.totalOverdue.toLocaleString('en-IN')}`,
        amount: ctx.invoices.totalOverdue,
        status: `${ctx.invoices.overdue} overdue`,
      });
    }
  }

  // GST-related questions
  if (q.includes('gst') || q.includes('return') || q.includes('filing') || q.includes('itc')) {
    records.push({
      kind: 'gst-return',
      id: 'gst_overview',
      label: 'GST Returns Overview',
      summary: `${ctx.gstReturns.filed} filed, ${ctx.gstReturns.draft} draft, ${ctx.gstReturns.overdue} overdue out of ${ctx.gstReturns.total} total`,
      status: `${ctx.gstReturns.filed}/${ctx.gstReturns.total} filed`,
    });
    if (ctx.gstReturns.nextDueDate) {
      records.push({
        kind: 'gst-return',
        id: 'gst_next_due',
        label: 'Next GST Filing Due',
        summary: `Next filing due ${ctx.gstReturns.nextDueDate}`,
        date: ctx.gstReturns.nextDueDate,
        status: 'upcoming',
      });
    }
  }

  // Cash/bank-related questions
  if (q.includes('cash') || q.includes('bank') || q.includes('balance') || q.includes('flow')) {
    records.push({
      kind: 'bank-transaction',
      id: 'bank_overview',
      label: 'Bank Accounts Overview',
      summary: `${ctx.bankAccounts.connected} connected accounts with ₹${ctx.bankAccounts.totalBalance.toLocaleString('en-IN')} total balance`,
      amount: ctx.bankAccounts.totalBalance,
      status: `${ctx.bankAccounts.connected}/${ctx.bankAccounts.total} connected`,
    });
    records.push({
      kind: 'payment',
      id: 'pay_recent',
      label: 'Recent Payments (90d)',
      summary: `₹${ctx.payments.received.toLocaleString('en-IN')} received, ₹${ctx.payments.paid.toLocaleString('en-IN')} paid`,
      amount: ctx.payments.received - ctx.payments.paid,
    });
  }

  // Compliance-related questions
  if (q.includes('compliance') || q.includes('deadline') || q.includes('filing') || q.includes('notice')) {
    records.push({
      kind: 'notice',
      id: 'compliance_score',
      label: 'Compliance Score',
      summary: `Current compliance score: ${ctx.compliance.score}/100 with ${ctx.compliance.pendingFilings} pending filings`,
      status: `${ctx.compliance.score}/100`,
    });
    if (ctx.compliance.upcomingDeadlines.length > 0) {
      for (const d of ctx.compliance.upcomingDeadlines.slice(0, 3)) {
        records.push({
          kind: 'task',
          id: `deadline_${d.title}`,
          label: d.title,
          summary: `${d.daysLeft < 0 ? `${Math.abs(d.daysLeft)} days overdue` : `${d.daysLeft} days remaining`} (due ${d.dueDate})`,
          date: d.dueDate,
          status: d.daysLeft < 0 ? 'overdue' : 'upcoming',
        });
      }
    }
  }

  // Expense/profit-related questions
  if (q.includes('expense') || q.includes('profit') || q.includes('margin') || q.includes('cost')) {
    records.push({
      kind: 'expense',
      id: 'exp_recent',
      label: 'Recent Expenses (90d)',
      summary: `${ctx.expenses.total} expense entries totaling ₹${ctx.expenses.totalAmount.toLocaleString('en-IN')}`,
      amount: ctx.expenses.totalAmount,
    });
  }

  return records;
}

function validateData(ctx: BusinessContext, _question: string): string[] {
  const gaps: string[] = [];
  if (!ctx.dataAvailability.hasInvoices) gaps.push('invoices');
  if (!ctx.dataAvailability.hasPayments) gaps.push('payments');
  if (!ctx.dataAvailability.hasBankAccounts) gaps.push('bank accounts');
  if (!ctx.dataAvailability.hasGstReturns) gaps.push('GST returns');
  if (!ctx.dataAvailability.hasClients) gaps.push('clients');
  if (!ctx.dataAvailability.hasExpenses) gaps.push('expenses');
  return gaps;
}

function analyzeTrends(ctx: BusinessContext, question: string): { finding: string } {
  const q = question.toLowerCase();

  // Overdue concentration
  if (q.includes('overdue') || q.includes('collection')) {
    if (ctx.invoices.totalOutstanding > 0) {
      const overduePct = ctx.invoices.totalOutstanding > 0
        ? (ctx.invoices.totalOverdue / ctx.invoices.totalOutstanding) * 100
        : 0;
      return {
        finding: overduePct > 50
          ? `Critical: ${overduePct.toFixed(0)}% of your outstanding receivables are overdue — collection needs immediate attention.`
          : overduePct > 25
            ? `Warning: ${overduePct.toFixed(0)}% of outstanding receivables are overdue.`
            : `Healthy: only ${overduePct.toFixed(0)}% of outstanding receivables are overdue.`,
      };
    }
  }

  // Cash flow trend
  if (q.includes('cash') || q.includes('flow')) {
    const netFlow = ctx.payments.received - ctx.payments.paid;
    return {
      finding: netFlow >= 0
        ? `Positive cash flow over last 90 days: ₹${netFlow.toLocaleString('en-IN')} net inflow.`
        : `Negative cash flow over last 90 days: ₹${Math.abs(netFlow).toLocaleString('en-IN')} net outflow — review expenses.`,
    };
  }

  // Compliance trend
  if (q.includes('compliance') || q.includes('gst')) {
    if (ctx.compliance.score >= 80) {
      return { finding: `Compliance is healthy at ${ctx.compliance.score}/100.` };
    } else if (ctx.compliance.score >= 60) {
      return { finding: `Compliance needs attention at ${ctx.compliance.score}/100 — ${ctx.compliance.pendingFilings} pending filings.` };
    } else {
      return { finding: `Compliance is at risk at ${ctx.compliance.score}/100 — immediate action required.` };
    }
  }

  return {
    finding: `Analysis based on ${ctx.invoices.total} invoices, ${ctx.payments.total} payments, ${ctx.gstReturns.total} GST returns, and ${ctx.expenses.total} expenses.`,
  };
}

function compareHistorical(ctx: BusinessContext, _question: string): { finding: string } {
  // Without a true historical dataset in this iteration, we report what we
  // CAN compare: the gap between filed and overdue GST returns.
  if (ctx.gstReturns.total > 0) {
    const filedPct = (ctx.gstReturns.filed / ctx.gstReturns.total) * 100;
    return {
      finding: `${filedPct.toFixed(0)}% of GST returns are filed (${ctx.gstReturns.filed}/${ctx.gstReturns.total}). ${ctx.gstReturns.overdue} overdue.`,
    };
  }
  return { finding: 'No historical GST return data available for comparison.' };
}

function calculateImpact(ctx: BusinessContext, question: string): { finding: string } {
  const q = question.toLowerCase();

  if (q.includes('collect') || q.includes('overdue')) {
    if (ctx.invoices.totalOverdue > 0) {
      const potentialCash = ctx.invoices.totalOverdue;
      return {
        finding: `Collecting all overdue invoices would inject ₹${potentialCash.toLocaleString('en-IN')} into your cash position.`,
      };
    }
  }

  if (q.includes('expense') || q.includes('cost')) {
    return {
      finding: `Total expenses over last 90 days: ₹${ctx.expenses.totalAmount.toLocaleString('en-IN')} (avg ₹${Math.round(ctx.expenses.totalAmount / 3).toLocaleString('en-IN')}/month).`,
    };
  }

  return {
    finding: `Net 90-day cash movement: ₹${(ctx.payments.received - ctx.payments.paid).toLocaleString('en-IN')} (received ₹${ctx.payments.received.toLocaleString('en-IN')} - paid ₹${ctx.payments.paid.toLocaleString('en-IN')}).`,
  };
}

function recommendActions(ctx: BusinessContext, question: string): { finding: string } {
  const recs: string[] = [];
  const q = question.toLowerCase();

  if (ctx.invoices.overdue > 0) {
    recs.push(`Send reminders for ${ctx.invoices.overdue} overdue invoices (₹${ctx.invoices.totalOverdue.toLocaleString('en-IN')})`);
  }
  if (ctx.gstReturns.overdue > 0) {
    recs.push(`File ${ctx.gstReturns.overdue} overdue GST returns immediately`);
  }
  if (ctx.compliance.upcomingDeadlines.length > 0) {
    const next = ctx.compliance.upcomingDeadlines[0];
    if (next.daysLeft <= 7) {
      recs.push(`Prepare ${next.title} (due in ${next.daysLeft} days)`);
    }
  }
  if (ctx.bankAccounts.connected === 0 && ctx.bankAccounts.total === 0) {
    recs.push('Connect a bank account to enable real-time cash position tracking');
  }
  if (ctx.invoices.draft > 0) {
    recs.push(`Send ${ctx.invoices.draft} draft invoices to clients`);
  }

  if (recs.length === 0) {
    if (q.includes('how') && q.includes('doing')) {
      return { finding: 'No urgent actions needed — business is in a stable state.' };
    }
    return { finding: 'No specific recommendations based on current data.' };
  }

  return {
    finding: `Recommended: ${recs.slice(0, 3).join('; ')}.`,
  };
}

function buildCalculationBreakdown(ctx: BusinessContext, question: string): string {
  const q = question.toLowerCase();
  const lines: string[] = [];

  if (q.includes('collect') || q.includes('overdue') || q.includes('outstanding')) {
    lines.push('CALCULATION: Outstanding Receivables');
    lines.push(`  Unpaid invoices: ${ctx.invoices.sent + ctx.invoices.overdue}`);
    lines.push(`  Total outstanding: ₹${ctx.invoices.totalOutstanding.toLocaleString('en-IN')}`);
    lines.push(`    of which overdue: ₹${ctx.invoices.totalOverdue.toLocaleString('en-IN')} (${ctx.invoices.overdue} invoices)`);
    lines.push(`    of which current: ₹${(ctx.invoices.totalOutstanding - ctx.invoices.totalOverdue).toLocaleString('en-IN')} (${ctx.invoices.sent} invoices)`);
  } else if (q.includes('cash') || q.includes('flow')) {
    lines.push('CALCULATION: 90-Day Cash Flow');
    lines.push(`  Inflows (customer payments): +₹${ctx.payments.received.toLocaleString('en-IN')}`);
    lines.push(`  Outflows (vendor payments):  -₹${ctx.payments.paid.toLocaleString('en-IN')}`);
    lines.push(`  Net cash flow:                ₹${(ctx.payments.received - ctx.payments.paid).toLocaleString('en-IN')}`);
    lines.push(`  Bank balance (connected):     ₹${ctx.bankAccounts.totalBalance.toLocaleString('en-IN')}`);
  } else if (q.includes('compliance') || q.includes('gst')) {
    lines.push('CALCULATION: Compliance Position');
    lines.push(`  Compliance score: ${ctx.compliance.score}/100`);
    lines.push(`  GST returns filed: ${ctx.gstReturns.filed}/${ctx.gstReturns.total}`);
    lines.push(`  Pending filings: ${ctx.compliance.pendingFilings}`);
    lines.push(`  Overdue returns: ${ctx.gstReturns.overdue}`);
    if (ctx.compliance.upcomingDeadlines.length > 0) {
      lines.push(`  Next deadline: ${ctx.compliance.upcomingDeadlines[0].title} (${ctx.compliance.upcomingDeadlines[0].daysLeft} days)`);
    }
  } else {
    lines.push('CALCULATION: Business Snapshot');
    lines.push(`  Active clients: ${ctx.clients.active}/${ctx.clients.total}`);
    lines.push(`  Invoice status: ${ctx.invoices.paid} paid, ${ctx.invoices.sent} sent, ${ctx.invoices.overdue} overdue, ${ctx.invoices.draft} draft`);
    lines.push(`  Outstanding: ₹${ctx.invoices.totalOutstanding.toLocaleString('en-IN')}`);
    lines.push(`  90-day net cash: ₹${(ctx.payments.received - ctx.payments.paid).toLocaleString('en-IN')}`);
    lines.push(`  Compliance score: ${ctx.compliance.score}/100`);
  }

  return lines.join('\n');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countUniqueSources(records: SupportingRecord[]): number {
  return new Set(records.map((r) => r.kind)).size;
}

async function timeStep<T extends { finding: string; records?: SupportingRecord[] }>(
  name: string,
  description: string,
  fn: () => Promise<T>,
): Promise<{ step: ReasoningStep; finding: string; records: SupportingRecord[]; result: T }> {
  const start = Date.now();
  try {
    const result = await fn();
    const durationMs = Date.now() - start;
    return {
      step: {
        step: 0, // will be set by caller
        name,
        description,
        status: 'success',
        finding: result.finding,
        durationMs,
        recordsTouched: result.records?.length ?? 0,
      },
      finding: result.finding,
      records: result.records ?? [],
      result,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    return {
      step: {
        step: 0,
        name,
        description,
        status: 'failed',
        finding: `Step failed: ${err instanceof Error ? err.message : 'unknown error'}`,
        durationMs,
        recordsTouched: 0,
      },
      finding: `Step ${name} failed.`,
      records: [],
      result: { finding: `Step ${name} failed.` } as T,
    };
  }
}
