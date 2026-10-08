// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Upgrade Phase 1 · Upgrade 2: Multi-Step Reasoning
//
// Diagnostic chains: predefined multi-step analysis pipelines that Oracle runs
// automatically when a user asks a complex question. Each chain is a sequence
// of analysis steps, each producing a finding that feeds the next step.
//
// Example (the GST liability chain from the spec):
//   "My GST liability increased this month."
//     → Analyze invoices (output tax up?)
//     → Analyze purchases (input tax down?)
//     → Analyze ITC availability (blocked credits?)
//     → Analyze bank data (payment timing?)
//     → Compare previous months (anomaly?)
//     → Generate explanation (root cause)
//     → Recommend solutions (actionable fixes)
//
// The chain runner executes each step, collects findings, and synthesizes
// a final answer with full traceability.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { routeToAgent, type AgentId } from './agents';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChainId =
  | 'gst-liability-increase'
  | 'cash-flow-gap'
  | 'compliance-risk'
  | 'collection-aging'
  | 'profit-margin-decline'
  | 'itc-mismatch';

export interface DiagnosticStep {
  id: string;
  label: string;
  /** The specialist agent that runs this step. */
  agent: AgentId;
  /** What this step investigates. */
  objective: string;
  /** The analysis function — returns a finding. */
  analyze: (ctx: ChainContext) => Promise<StepFinding>;
}

export interface StepFinding {
  stepId: string;
  label: string;
  status: 'ok' | 'warning' | 'critical' | 'info';
  summary: string;
  /** Key metrics extracted during this step. */
  metrics: { label: string; value: string }[];
  /** Evidence references (invoice IDs, transaction IDs, etc.) */
  evidence: string[];
  /** Whether this step found something that contributes to the diagnosis. */
  contributes: boolean;
}

export interface ChainContext {
  /** Months of data to analyze. */
  monthsBack: number;
  /** Gathered raw data (populated by the runner). */
  invoices: Array<Record<string, unknown>>;
  purchases: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
  bankTransactions: Array<Record<string, unknown>>;
  gstrFilings: Array<Record<string, unknown>>;
  clients: Array<Record<string, unknown>>;
}

export interface DiagnosticResult {
  chainId: ChainId;
  chainName: string;
  trigger: string;
  startedAt: string;
  completedAt: string;
  steps: StepFinding[];
  /** Root cause synthesis. */
  rootCause: string;
  /** Recommended actions, prioritized. */
  recommendations: { action: string; priority: 'high' | 'medium' | 'low'; impact: string }[];
  /** Overall confidence in the diagnosis. */
  confidence: number;
  /** Which agent is responsible for follow-up. */
  leadAgent: AgentId;
}

// ─── Data gathering ───────────────────────────────────────────────────────────

async function gatherChainData(monthsBack = 6): Promise<ChainContext> {
  const since = new Date();
  since.setMonth(since.getMonth() - monthsBack);

  const ctx: ChainContext = {
    monthsBack,
    invoices: [],
    purchases: [],
    payments: [],
    bankTransactions: [],
    gstrFilings: [],
    clients: [],
  };

  try {
    ctx.invoices = await db.invoice.findMany({
      where: { invoiceDate: { gte: since.toISOString().slice(0, 10) } },
    }) as unknown as Array<Record<string, unknown>>;
  } catch { /* graceful */ }

  try {
    ctx.purchases = await db.purchaseBill.findMany({
      where: { invoiceDate: { gte: since.toISOString().slice(0, 10) } },
    }) as unknown as Array<Record<string, unknown>>;
  } catch { /* graceful */ }

  try {
    ctx.payments = await db.payment.findMany({
      where: { paymentDate: { gte: since.toISOString().slice(0, 10) } },
    }) as unknown as Array<Record<string, unknown>>;
  } catch { /* graceful */ }

  try {
    ctx.gstrFilings = await db.gSTRFiling.findMany({}) as unknown as Array<Record<string, unknown>>;
  } catch { /* graceful */ }

  try {
    ctx.clients = await db.client.findMany({}) as unknown as Array<Record<string, unknown>>;
  } catch { /* graceful */ }

  return ctx;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthKey(iso: string | unknown): string | null {
  if (typeof iso !== 'string' || !iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function groupByMonth<T extends Record<string, unknown>>(
  arr: T[],
  dateField: string,
): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const item of arr) {
    const k = monthKey(item[dateField]);
    if (!k) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(item);
  }
  return m;
}

function sumField<T extends Record<string, unknown>>(arr: T[], field: string): number {
  return arr.reduce((s, x) => s + (Number(x[field]) || 0), 0);
}

function inrShort(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

// ─── Chain: GST Liability Increase ────────────────────────────────────────────
// "My GST liability increased this month."
// Steps: invoices → purchases → ITC → bank → compare → explain → recommend

const gstLiabilityChain: DiagnosticStep[] = [
  {
    id: 'analyze-invoices',
    label: 'Analyze Sales Invoices (Output Tax)',
    agent: 'gst',
    objective: 'Check if output GST increased due to higher sales volume or rate changes.',
    analyze: async (ctx) => {
      const byMonth = groupByMonth(ctx.invoices, 'invoiceDate');
      const months = Array.from(byMonth.keys()).sort();
      const outputByMonth = months.map((k) => ({
        month: k,
        output: sumField(byMonth.get(k)!, 'igst') + sumField(byMonth.get(k)!, 'cgst') + sumField(byMonth.get(k)!, 'sgst'),
        revenue: sumField(byMonth.get(k)!, 'totalAmount'),
      }));

      const latest = outputByMonth[outputByMonth.length - 1];
      const prev = outputByMonth[outputByMonth.length - 2];
      const increased = latest && prev ? latest.output > prev.output * 1.1 : false;

      return {
        stepId: 'analyze-invoices',
        label: 'Sales Invoices Analysis',
        status: increased ? 'warning' : 'ok',
        summary: increased
          ? `Output GST increased from ${inrShort(prev.output)} to ${inrShort(latest.output)} (${((latest.output - prev.output) / prev.output * 100).toFixed(0)}% rise). Revenue went from ${inrShort(prev.revenue)} to ${inrShort(latest.revenue)}.`
          : latest
            ? `Output GST for ${latest.month}: ${inrShort(latest.output)}. No significant increase detected.`
            : 'No invoice data available for analysis.',
        metrics: outputByMonth.slice(-3).map((m) => ({
          label: m.month,
          value: `${inrShort(m.output)} (rev: ${inrShort(m.revenue)})`,
        })),
        evidence: ctx.invoices.slice(0, 5).map((i) => String(i.invoiceNumber ?? i.id ?? '')),
        contributes: increased,
      };
    },
  },
  {
    id: 'analyze-purchases',
    label: 'Analyze Purchase Bills (Input Tax)',
    agent: 'gst',
    objective: 'Check if input GST decreased due to lower purchases or vendor delays.',
    analyze: async (ctx) => {
      const byMonth = groupByMonth(ctx.purchases, 'invoiceDate');
      const months = Array.from(byMonth.keys()).sort();
      const inputByMonth = months.map((k) => ({
        month: k,
        input: sumField(byMonth.get(k)!, 'igst') + sumField(byMonth.get(k)!, 'cgst') + sumField(byMonth.get(k)!, 'sgst'),
        spend: sumField(byMonth.get(k)!, 'totalAmount'),
      }));

      const latest = inputByMonth[inputByMonth.length - 1];
      const prev = inputByMonth[inputByMonth.length - 2];
      const decreased = latest && prev ? latest.input < prev.input * 0.9 : false;

      return {
        stepId: 'analyze-purchases',
        label: 'Purchase Bills Analysis',
        status: decreased ? 'warning' : 'ok',
        summary: decreased
          ? `Input GST decreased from ${inrShort(prev.input)} to ${inrShort(latest.input)} (${((prev.input - latest.input) / prev.input * 100).toFixed(0)}% drop). Purchase spend went from ${inrShort(prev.spend)} to ${inrShort(latest.spend)}.`
          : latest
            ? `Input GST for ${latest.month}: ${inrShort(latest.input)}. No significant decrease.`
            : 'No purchase data available for analysis.',
        metrics: inputByMonth.slice(-3).map((m) => ({
          label: m.month,
          value: `${inrShort(m.input)} (spend: ${inrShort(m.spend)})`,
        })),
        evidence: ctx.purchases.slice(0, 5).map((p) => String(p.id ?? '')),
        contributes: decreased,
      };
    },
  },
  {
    id: 'analyze-itc',
    label: 'Analyze ITC Availability',
    agent: 'gst',
    objective: 'Check if ITC is blocked or delayed due to GSTR-2B mismatches.',
    analyze: async (ctx) => {
      const filings = ctx.gstrFilings;
      const pending = filings.filter((f) => String(f.status ?? '').toLowerCase() === 'pending' || String(f.status ?? '').toLowerCase() === 'draft');
      const withIssues = filings.filter((f) => Number(f.issuesFound ?? 0) > 0 || Number(f.criticalErrors ?? 0) > 0);

      return {
        stepId: 'analyze-itc',
        label: 'ITC Availability Analysis',
        status: withIssues.length > 0 ? 'warning' : 'ok',
        summary: withIssues.length > 0
          ? `${withIssues.length} filing(s) have issues (${filings.reduce((s, f) => s + Number(f.criticalErrors ?? 0), 0)} critical errors). ${pending.length} filing(s) still in draft/pending. This could block legitimate ITC claims.`
          : `All ${filings.length} filing(s) show no issues. No ITC blockage detected.`,
        metrics: [
          { label: 'Total filings', value: String(filings.length) },
          { label: 'Pending/Draft', value: String(pending.length) },
          { label: 'With issues', value: String(withIssues.length) },
        ],
        evidence: withIssues.slice(0, 3).map((f) => String(f.id ?? f.period ?? '')),
        contributes: withIssues.length > 0,
      };
    },
  },
  {
    id: 'analyze-bank',
    label: 'Analyze Bank Data (Payment Timing)',
    agent: 'cashflow',
    objective: 'Check if GST payments were delayed or if cash position affects compliance.',
    analyze: async (ctx) => {
      const gstPayments = ctx.payments.filter((p) => {
        const desc = String(p.notes ?? p.partyName ?? '').toLowerCase();
        return desc.includes('gst') || desc.includes('tax');
      });

      return {
        stepId: 'analyze-bank',
        label: 'Bank Payment Analysis',
        status: 'info',
        summary: gstPayments.length > 0
          ? `${gstPayments.length} GST-related payment(s) found. Verify they were made before due dates to avoid late fees.`
          : 'No GST-specific payments detected in bank data. This may indicate pending liability.',
        metrics: [
          { label: 'GST payments found', value: String(gstPayments.length) },
        ],
        evidence: gstPayments.slice(0, 3).map((p) => String(p.id ?? '')),
        contributes: gstPayments.length === 0,
      };
    },
  },
  {
    id: 'compare-months',
    label: 'Compare Previous Months',
    agent: 'audit',
    objective: 'Determine if the increase is anomalous vs. seasonal pattern.',
    analyze: async (ctx) => {
      const byMonth = groupByMonth(ctx.invoices, 'invoiceDate');
      const months = Array.from(byMonth.keys()).sort();
      if (months.length < 2) {
        return {
          stepId: 'compare-months',
          label: 'Month-over-Month Comparison',
          status: 'info',
          summary: 'Insufficient history for comparison (need ≥2 months).',
          metrics: [],
          evidence: [],
          contributes: false,
        };
      }

      const outputs = months.map((k) => sumField(byMonth.get(k)!, 'igst') + sumField(byMonth.get(k)!, 'cgst') + sumField(byMonth.get(k)!, 'sgst'));
      const avg = outputs.slice(0, -1).reduce((s, x) => s + x, 0) / Math.max(1, outputs.length - 1);
      const latest = outputs[outputs.length - 1];
      const variance = avg > 0 ? ((latest - avg) / avg) * 100 : 0;

      return {
        stepId: 'compare-months',
        label: 'Month-over-Month Comparison',
        status: Math.abs(variance) > 20 ? 'warning' : 'ok',
        summary: `Latest month output GST is ${variance > 0 ? 'above' : 'below'} the ${months.length - 1}-month average by ${Math.abs(variance).toFixed(0)}%. Average: ${inrShort(avg)}, Latest: ${inrShort(latest)}.`,
        metrics: [
          { label: 'Avg (prev months)', value: inrShort(avg) },
          { label: 'Latest month', value: inrShort(latest) },
          { label: 'Variance', value: `${variance > 0 ? '+' : ''}${variance.toFixed(0)}%` },
        ],
        evidence: months,
        contributes: Math.abs(variance) > 15,
      };
    },
  },
];

// ─── Chain: Cash Flow Gap ─────────────────────────────────────────────────────

const cashFlowGapChain: DiagnosticStep[] = [
  {
    id: 'analyze-inflows',
    label: 'Analyze Cash Inflows (Collections)',
    agent: 'cashflow',
    objective: 'Quantify incoming cash velocity.',
    analyze: async (ctx) => {
      const inflows = ctx.payments.filter((p) => String(p.partyType ?? 'customer') === 'customer');
      const total = sumField(inflows, 'amount');
      return {
        stepId: 'analyze-inflows',
        label: 'Cash Inflows Analysis',
        status: total > 0 ? 'ok' : 'warning',
        summary: `${inflows.length} inflow payment(s) totaling ${inrShort(total)} over the last ${ctx.monthsBack} months.`,
        metrics: [
          { label: 'Total inflows', value: inrShort(total) },
          { label: 'Count', value: String(inflows.length) },
        ],
        evidence: inflows.slice(0, 3).map((p) => String(p.id ?? '')),
        contributes: total === 0,
      };
    },
  },
  {
    id: 'analyze-outflows',
    label: 'Analyze Cash Outflows (Payments)',
    agent: 'cashflow',
    objective: 'Quantify outgoing cash obligations.',
    analyze: async (ctx) => {
      const outflows = ctx.payments.filter((p) => String(p.partyType ?? '') === 'vendor');
      const total = sumField(outflows, 'amount');
      return {
        stepId: 'analyze-outflows',
        label: 'Cash Outflows Analysis',
        status: 'ok',
        summary: `${outflows.length} outflow payment(s) totaling ${inrShort(total)} over the last ${ctx.monthsBack} months.`,
        metrics: [
          { label: 'Total outflows', value: inrShort(total) },
          { label: 'Count', value: String(outflows.length) },
        ],
        evidence: outflows.slice(0, 3).map((p) => String(p.id ?? '')),
        contributes: true,
      };
    },
  },
  {
    id: 'compute-gap',
    label: 'Compute Net Cash Gap',
    agent: 'finance',
    objective: 'Calculate the net cash position and identify shortfall periods.',
    analyze: async (ctx) => {
      const inflows = ctx.payments.filter((p) => String(p.partyType ?? 'customer') === 'customer');
      const outflows = ctx.payments.filter((p) => String(p.partyType ?? '') === 'vendor');
      const net = sumField(inflows, 'amount') - sumField(outflows, 'amount');
      return {
        stepId: 'compute-gap',
        label: 'Net Cash Position',
        status: net < 0 ? 'critical' : net < 100000 ? 'warning' : 'ok',
        summary: `Net cash position: ${inrShort(net)}. ${net < 0 ? 'Negative — cash gap detected. Immediate action needed.' : 'Positive but monitor for upcoming obligations.'}`,
        metrics: [
          { label: 'Net position', value: inrShort(net) },
          { label: 'Monthly avg', value: inrShort(net / ctx.monthsBack) },
        ],
        evidence: [],
        contributes: true,
      };
    },
  },
];

// ─── Chain registry ───────────────────────────────────────────────────────────

export const DIAGNOSTIC_CHAINS: Record<ChainId, { name: string; trigger: string; steps: DiagnosticStep[]; leadAgent: AgentId }> = {
  'gst-liability-increase': {
    name: 'GST Liability Increase Analysis',
    trigger: 'User reports increased GST liability',
    steps: gstLiabilityChain,
    leadAgent: 'gst',
  },
  'cash-flow-gap': {
    name: 'Cash Flow Gap Analysis',
    trigger: 'User reports cash flow concerns',
    steps: cashFlowGapChain,
    leadAgent: 'cashflow',
  },
  'compliance-risk': {
    name: 'Compliance Risk Assessment',
    trigger: 'User asks about compliance status',
    steps: [
      {
        id: 'filing-status',
        label: 'Check Filing Status',
        agent: 'compliance',
        objective: 'Identify overdue or pending filings.',
        analyze: async (ctx) => ({
          stepId: 'filing-status',
          label: 'Filing Status Check',
          status: ctx.gstrFilings.length === 0 ? 'warning' : 'ok',
          summary: `${ctx.gstrFilings.length} GSTR filing(s) on record.`,
          metrics: [{ label: 'Total filings', value: String(ctx.gstrFilings.length) }],
          evidence: [],
          contributes: ctx.gstrFilings.length === 0,
        }),
      },
    ],
    leadAgent: 'compliance',
  },
  'collection-aging': {
    name: 'Collection Aging Analysis',
    trigger: 'User asks about receivables or collections',
    steps: [
      {
        id: 'overdue-invoices',
        label: 'Identify Overdue Invoices',
        agent: 'collections',
        objective: 'Find invoices past their due date.',
        analyze: async (ctx) => {
          const now = new Date();
          const overdue = ctx.invoices.filter((inv) => {
            const due = inv.dueDate as string | undefined;
            const status = String(inv.status ?? '');
            return due && new Date(due) < now && status !== 'paid';
          });
          return {
            stepId: 'overdue-invoices',
            label: 'Overdue Invoice Scan',
            status: overdue.length > 5 ? 'critical' : overdue.length > 0 ? 'warning' : 'ok',
            summary: `${overdue.length} overdue invoice(s) detected.`,
            metrics: [{ label: 'Overdue count', value: String(overdue.length) }],
            evidence: overdue.slice(0, 5).map((i) => String(i.invoiceNumber ?? i.id ?? '')),
            contributes: overdue.length > 0,
          };
        },
      },
    ],
    leadAgent: 'collections',
  },
  'profit-margin-decline': {
    name: 'Profit Margin Decline Analysis',
    trigger: 'User reports declining margins',
    steps: [
      {
        id: 'revenue-vs-expense',
        label: 'Compare Revenue vs Expense Trends',
        agent: 'finance',
        objective: 'Determine if margins are shrinking due to revenue drop or cost increase.',
        analyze: async (ctx) => {
          const rev = sumField(ctx.invoices, 'totalAmount');
          const exp = sumField(ctx.purchases, 'totalAmount');
          const margin = rev > 0 ? ((rev - exp) / rev) * 100 : 0;
          return {
            stepId: 'revenue-vs-expense',
            label: 'Margin Analysis',
            status: margin < 10 ? 'warning' : 'ok',
            summary: `Current margin: ${margin.toFixed(1)}%. Revenue: ${inrShort(rev)}, Expenses: ${inrShort(exp)}.`,
            metrics: [
              { label: 'Revenue', value: inrShort(rev) },
              { label: 'Expenses', value: inrShort(exp) },
              { label: 'Margin', value: `${margin.toFixed(1)}%` },
            ],
            evidence: [],
            contributes: true,
          };
        },
      },
    ],
    leadAgent: 'finance',
  },
  'itc-mismatch': {
    name: 'ITC Mismatch Investigation',
    trigger: 'User reports ITC reconciliation issues',
    steps: [
      {
        id: 'itc-reconcile',
        label: 'Reconcile ITC (2B vs Books)',
        agent: 'gst',
        objective: 'Find ITC claimed but not in 2B, or vice versa.',
        analyze: async (ctx) => {
          const mismatched = ctx.gstrFilings.filter((f) =>
            Number(f.issuesFound ?? 0) > 0 || Number(f.criticalErrors ?? 0) > 0,
          );
          return {
            stepId: 'itc-reconcile',
            label: 'ITC Reconciliation',
            status: mismatched.length > 0 ? 'warning' : 'ok',
            summary: `${mismatched.length} filing(s) with reconciliation issues.`,
            metrics: [{ label: 'Filings with issues', value: String(mismatched.length) }],
            evidence: mismatched.slice(0, 3).map((f) => String(f.id ?? f.period ?? '')),
            contributes: mismatched.length > 0,
          };
        },
      },
    ],
    leadAgent: 'gst',
  },
};

// ─── Runner ───────────────────────────────────────────────────────────────────

/**
 * Auto-detect the right chain based on the user's query, or run a specific chain.
 */
export function detectChain(query: string): ChainId | null {
  const q = query.toLowerCase();
  if (/gst.*(liability|increased|high|up)/i.test(q) || /liability.*(gst|tax)/i.test(q)) return 'gst-liability-increase';
  if (/cash\s*flow|liquidity|runway|burn/i.test(q)) return 'cash-flow-gap';
  if (/compliance|risk|deadline|penalt/i.test(q)) return 'compliance-risk';
  if (/collection|receivable|overdue|aging|outstanding/i.test(q)) return 'collection-aging';
  if (/margin|profitab.*declin|margin.*down/i.test(q)) return 'profit-margin-decline';
  if (/itc|mismatch|reconcil/i.test(q)) return 'itc-mismatch';
  return null;
}

export async function runDiagnosticChain(
  chainId: ChainId,
  query?: string,
): Promise<DiagnosticResult> {
  const chain = DIAGNOSTIC_CHAINS[chainId];
  const startedAt = new Date().toISOString();
  const ctx = await gatherChainData();

  const findings: StepFinding[] = [];
  for (const step of chain.steps) {
    try {
      const finding = await step.analyze(ctx);
      findings.push(finding);
    } catch (e) {
      findings.push({
        stepId: step.id,
        label: step.label,
        status: 'info',
        summary: `Step skipped due to error: ${e instanceof Error ? e.message : 'unknown'}`,
        metrics: [],
        evidence: [],
        contributes: false,
      });
    }
  }

  // Synthesize root cause from contributing findings
  const contributing = findings.filter((f) => f.contributes);
  const rootCause = contributing.length > 0
    ? contributing.map((f) => f.summary).join(' ')
    : 'No single root cause identified. All steps passed baseline checks.';

  // Generate recommendations based on findings
  const recommendations: DiagnosticResult['recommendations'] = [];
  if (chainId === 'gst-liability-increase') {
    if (contributing.some((f) => f.stepId === 'analyze-invoices')) {
      recommendations.push({
        action: 'Review invoice mix for rate changes — verify HSN classifications are correct',
        priority: 'high',
        impact: 'Could reduce output tax if misclassified at 28% instead of 18%',
      });
    }
    if (contributing.some((f) => f.stepId === 'analyze-purchases')) {
      recommendations.push({
        action: 'Expedite pending purchase bills to claim ITC this period',
        priority: 'high',
        impact: 'Each ₹1L of unclaimed ITC increases net liability by ₹18K',
      });
    }
    if (contributing.some((f) => f.stepId === 'analyze-itc')) {
      recommendations.push({
        action: 'Reconcile GSTR-2B against purchase register — resolve mismatches before filing',
        priority: 'high',
        impact: 'Blocked ITC directly increases cash outflow',
      });
    }
    recommendations.push({
      action: 'Set up monthly GST liability forecast to predict spikes 30 days in advance',
      priority: 'medium',
      impact: 'Prevents surprise liabilities and enables cash planning',
    });
  } else if (chainId === 'cash-flow-gap') {
    recommendations.push({
      action: 'Accelerate collections — send reminders to top 5 overdue customers today',
      priority: 'high',
      impact: 'Each day of delay costs ~0.03% of receivables in opportunity cost',
    });
    recommendations.push({
      action: 'Negotiate 15-day extension with top 3 vendors',
      priority: 'medium',
      impact: 'Smooths cash outflow without damaging relationships',
    });
    recommendations.push({
      action: 'Arrange overdraft facility for 30-day bridging',
      priority: 'low',
      impact: 'Provides safety net at ~12% annual cost',
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      action: 'Continue monitoring — no immediate action required',
      priority: 'low',
      impact: 'Maintain current course',
    });
  }

  // Confidence based on data availability and finding consistency
  const dataPoints = ctx.invoices.length + ctx.purchases.length + ctx.payments.length + ctx.gstrFilings.length;
  const confidence = dataPoints > 50 ? 0.85 : dataPoints > 10 ? 0.65 : dataPoints > 0 ? 0.4 : 0.15;

  return {
    chainId,
    chainName: chain.name,
    trigger: query ?? chain.trigger,
    startedAt,
    completedAt: new Date().toISOString(),
    steps: findings,
    rootCause,
    recommendations,
    confidence,
    leadAgent: chain.leadAgent,
  };
}
